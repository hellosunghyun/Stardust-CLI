import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import ora from "ora";
import { loadConfig, type Config } from "../utils/config";
import { delay } from "../utils/rate-limiter";
import { GeminiService } from "../services/gemini";
import type { Category, CreatedList, RepoSummary } from "../types";
import type { BatchRepoInfo } from "../prompts/classifier";
import {
  fetchAllMyStarredRepos,
  fetchGitHubLists,
  deleteAllGitHubLists,
  createGitHubList,
  fetchRepositoryReadme,
  getRepositoryNodeId,
  addRepoToGitHubLists,
  type Repo,
} from "../api";

export const runCommand = new Command("run")
  .description("Run full workflow automatically (plan → delete → create → classify)")
  .option("--only-new", "Process only Stars not yet added to Lists (keep existing Lists)")
  .option("--dry-run", "Simulation mode (only preview category planning)")
  .action(async (options) => {
    try {
      const config = loadConfig();
      const gemini = new GeminiService(config);

      if (config.debug) {
        console.log("\n[DEBUG] Config:", {
          maxCategories: config.maxCategories,
          classifyBatchSize: config.classifyBatchSize,
          geminiModel: config.geminiModel,
        });
      }

      console.log("\n🚀 Starting GitHub Stars auto-organization.\n");

      // ========================================
      // Step 1: Fetch starred repos
      // ========================================
      const allRepos = await fetchStarredRepos(config);
      if (allRepos.length === 0) {
        console.log("No starred repositories found.");
        return;
      }

      // ========================================
      // Step 2: For --only-new, check existing Lists and filter
      // ========================================
      let repos: Repo[];
      let existingLists: Map<string, CreatedList> | null = null;
      let existingCategories: Category[] | null = null;

      if (options.onlyNew) {
        const result = await filterNewReposOnly(config, allRepos);
        repos = result.newRepos;
        existingLists = result.existingLists;
        existingCategories = result.existingCategories;

        if (repos.length === 0) {
          console.log("\n✅ All Stars are already added to Lists.");
          return;
        }

        if (existingCategories.length === 0) {
          console.log("\n⚠️ No existing Lists found. Please run again without --only-new.");
          return;
        }
      } else {
        repos = allRepos;
      }

      // ========================================
      // Step 3: Plan categories (if not --only-new)
      // ========================================
      let categories: Category[];

      if (options.onlyNew && existingCategories) {
        categories = existingCategories;
        console.log(`\n📋 Using existing ${categories.length} categories`);
      } else {
        categories = await planCategories(gemini, repos, config);
      }

      // ========================================
      // Step 4: Exit here for dry run
      // ========================================
      if (options.dryRun) {
        displayDryRunResults(categories, config, repos.length);
        return;
      }

      // ========================================
      // Step 5: Delete existing Lists (if not --only-new)
      // ========================================
      if (!options.onlyNew) {
        await deleteExistingLists(config);
      }

      // ========================================
      // Step 6: Create Lists (if not --only-new)
      // ========================================
      let createdLists: Map<string, CreatedList>;

      if (options.onlyNew && existingLists && existingLists.size > 0) {
        createdLists = existingLists;
        console.log(`\n📁 Using existing ${createdLists.size} Lists`);
      } else {
        createdLists = await createLists(config, categories);
      }

      // ========================================
      // Step 7: Classify and add to Lists
      // ========================================
      await classifyAndAddRepos(config, gemini, repos, categories, createdLists);

      console.log("\n✅ Done! Stars have been organized into Lists.");
    } catch (error) {
      console.error("\n❌ Error:", (error as Error).message);
      process.exit(1);
    }
  });

// ============================================
// Helper Functions
// ============================================

async function fetchStarredRepos(config: Config): Promise<Repo[]> {
  const spinner = ora("Fetching starred repositories...").start();

  const result = await fetchAllMyStarredRepos(
    config.githubToken,
    config.githubUsername,
    (count) => {
      spinner.text = `Fetching starred repositories... (${count})`;
    },
  );

  if (result.status !== 200 || !result.repos) {
    spinner.fail("Failed to fetch starred repositories");
    throw new Error(`Failed to fetch starred repos: status ${result.status}`);
  }

  spinner.succeed(`Fetched ${result.repos.length} starred repositories.`);
  return result.repos;
}

async function filterNewReposOnly(
  config: Config,
  allRepos: Repo[],
): Promise<{
  newRepos: Repo[];
  existingLists: Map<string, CreatedList>;
  existingCategories: Category[];
}> {
  const spinner = ora("Checking existing Lists...").start();

  const listsData = await fetchGitHubLists(config.githubUsername, config.githubToken);

  const addedRepoNames = new Set<string>();
  const existingLists = new Map<string, CreatedList>();
  const existingCategories: Category[] = [];

  for (const list of listsData.lists) {
    existingLists.set(list.name, {
      id: list.id,
      name: list.name,
      description: list.description,
    });

    existingCategories.push({
      name: list.name,
      description: list.description || "",
      keywords: [],
    });

    for (const repo of list.repositories) {
      addedRepoNames.add(`${repo.owner}/${repo.name}`);
    }
  }

  const newRepos = allRepos.filter(
    (repo) => !addedRepoNames.has(`${repo.owner.login}/${repo.name}`),
  );

  const skipped = allRepos.length - newRepos.length;
  spinner.succeed(`${skipped} already added → ${newRepos.length} new repositories to process`);

  return { newRepos, existingLists, existingCategories };
}

async function planCategories(
  gemini: GeminiService,
  repos: Repo[],
  config: Config,
): Promise<Category[]> {
  const spinner = ora(`AI is planning ${config.maxCategories} categories...`).start();

  const repoSummaries: RepoSummary[] = repos.map((r) => ({
    owner: r.owner.login,
    name: r.name,
    description: r.description,
    language: r.language,
    stars: r.stargazers_count,
  }));

  try {
    const categories = await gemini.planCategories(repoSummaries);
    spinner.succeed(`${categories.length} categories have been planned.`);
    return categories;
  } catch (error) {
    spinner.fail("Failed to plan categories");
    throw error;
  }
}

function displayDryRunResults(categories: Category[], config: Config, repoCount: number) {
  console.log("\n📋 [Dry Run] Planned Categories:\n");
  console.log("─".repeat(60));

  categories.forEach((c, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. ${c.name}`);
    if (c.description) {
      console.log(`    ${c.description}`);
    }
  });

  console.log("─".repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`  - Categories: ${categories.length}`);
  console.log(`  - Target repositories: ${repoCount}`);
  console.log(`  - Batch size: ${config.classifyBatchSize}`);
  console.log(`  - Gemini model: ${config.geminiModel}`);
  console.log("\n(Dry run mode - no actual execution.)");
}

async function deleteExistingLists(config: Config) {
  const spinner = ora("Checking existing Lists...").start();
  const data = await fetchGitHubLists(config.githubUsername, config.githubToken);

  if (data.totalLists === 0) {
    spinner.succeed("No existing Lists");
    return;
  }

  spinner.stop();

  const shouldDelete = await confirm({
    message: `Delete existing ${data.totalLists} Lists?`,
    default: true,
  });

  if (!shouldDelete) {
    console.log("Cancelled.");
    process.exit(0);
  }

  const deleteSpinner = ora(`Deleting Lists... (0/${data.totalLists})`).start();
  const deletedCount = await deleteAllGitHubLists(
    config.githubUsername,
    config.githubToken,
    (deleted, total) => {
      deleteSpinner.text = `Deleting Lists... (${deleted}/${total})`;
    },
  );
  deleteSpinner.succeed(`${deletedCount} Lists deleted`);
}

async function createLists(
  config: Config,
  categories: Category[],
): Promise<Map<string, CreatedList>> {
  const spinner = ora("Creating Lists...").start();
  const createdLists = new Map<string, CreatedList>();
  let created = 0;

  for (const category of categories) {
    try {
      const result = await createGitHubList(
        config.githubToken,
        category.name,
        category.description,
        config.listIsPrivate,
      );

      createdLists.set(category.name, {
        id: result.list.id,
        name: result.list.name,
        description: result.list.description,
      });

      created++;
      spinner.text = `Creating Lists... (${created}/${categories.length})`;

      await delay(config.listCreateDelay);
    } catch (error) {
      console.warn(`\n  ⚠️ Failed to create "${category.name}"`);
    }
  }

  spinner.succeed(`${created} Lists created`);
  return createdLists;
}

async function classifyAndAddRepos(
  config: Config,
  gemini: GeminiService,
  repos: Repo[],
  categories: Category[],
  createdLists: Map<string, CreatedList>,
) {
  const batchSize = config.classifyBatchSize;
  const totalBatches = Math.ceil(repos.length / batchSize);

  console.log(`\n📂 Classifying ${repos.length} repositories in batches of ${batchSize}...\n`);

  let success = 0;
  let failed = 0;

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batchStart = batchIdx * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, repos.length);
    const batchRepos = repos.slice(batchStart, batchEnd);

    console.log(`── Batch ${batchIdx + 1}/${totalBatches} (${batchStart + 1}-${batchEnd}) ──`);

    // Fetch README
    const spinner = ora(`Fetching README... (0/${batchRepos.length})`).start();
    let readmeCount = 0;
    const batchRepoInfos: BatchRepoInfo[] = await Promise.all(
      batchRepos.map(async (repo) => {
        const readme = await fetchRepositoryReadme(
          config.githubToken,
          repo.owner.login,
          repo.name,
        );
        readmeCount++;
        spinner.text = `Fetching README... (${readmeCount}/${batchRepos.length})`;
        return {
          id: `${repo.owner.login}/${repo.name}`,
          description: repo.description,
          language: repo.language,
          stars: repo.stargazers_count,
          readme,
        };
      }),
    );
    spinner.succeed(`README fetched (${batchRepos.length})`);

    // AI classification
    const classifySpinner = ora("AI classifying...").start();
    let results: Map<string, string[]>;
    try {
      results = await gemini.classifyRepositoriesBatch(batchRepoInfos, categories);
      classifySpinner.succeed("Classification complete");
    } catch (error) {
      classifySpinner.fail("Classification failed");
      failed += batchRepos.length;
      continue;
    }

    // Add to Lists (parallel processing)
    const addSpinner = ora(`Adding to Lists...`).start();
    const addResults = await Promise.all(
      batchRepos.map(async (repo) => {
        const repoId = `${repo.owner.login}/${repo.name}`;
        const categoryNames = results.get(repoId) || [];

        try {
          const listIds = categoryNames
            .map((name) => createdLists.get(name)?.id)
            .filter((id): id is string => !!id);

          if (listIds.length === 0) {
            return { repoId, success: false, error: "No matching category" };
          }

          const repoNodeId = await getRepositoryNodeId(
            config.githubToken,
            repo.owner.login,
            repo.name,
          );
          await addRepoToGitHubLists(config.githubToken, repoNodeId, listIds);
          return { repoId, success: true, categories: categoryNames };
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          return { repoId, success: false, error: errMsg };
        }
      }),
    );

    // Count results
    for (const result of addResults) {
      if (result.success) {
        success++;
      } else {
        failed++;
      }
    }
    addSpinner.succeed(`Added to Lists (${batchRepos.length})`);

    // Output results
    for (const result of addResults) {
      if (result.success && result.categories) {
        console.log(`  ✅ ${result.repoId} → ${result.categories.slice(0, 2).join(", ")}`);
      } else {
        console.log(`  ❌ ${result.repoId} (${result.error})`);
      }
    }

    if (batchIdx < totalBatches - 1) {
      await delay(config.batchDelay);
    }
  }

  console.log("\n📊 Results:");
  console.log(`  ✅ Success: ${success}`);
  console.log(`  ❌ Failed: ${failed}`);
}
