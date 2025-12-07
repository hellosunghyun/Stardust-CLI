import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import ora from "ora";
import { loadConfig } from "../utils/config";
import { loadPlan } from "../utils/plan-storage";
import { delay } from "../utils/rate-limiter";
import { GeminiService } from "../services/gemini";
import type { Category, CreatedList } from "../types";
import type { BatchRepoInfo } from "../prompts/classifier";
import {
  fetchAllMyStarredRepos,
  fetchGitHubLists,
  fetchRepositoryReadme,
  getRepositoryNodeId,
  addRepoToGitHubLists,
  removeRepoFromAllLists,
  type Repo,
} from "../api";

export const classifyCommand = new Command("classify")
  .description("Classify Stars and add to Lists")
  .option("--only-new", "Process only Stars not yet added to Lists")
  .option("--use-existing", "Use existing Lists as categories (no plan file needed)")
  .option("--reset", "Remove all Stars from Lists (undo)")
  .action(async (options) => {
    try {
      const config = loadConfig();

      // --reset: Remove Stars from Lists
      if (options.reset) {
        await handleReset(config);
        return;
      }

      const gemini = new GeminiService(config);

      console.log("\n📂 Starting Stars classification.\n");

      // Step 1: Check existing Lists and create mapping
      const spinner = ora("Checking existing Lists...").start();
      const listsData = await fetchGitHubLists(config.githubUsername, config.githubToken);

      if (listsData.totalLists === 0) {
        spinner.fail("No Lists found.");
        console.log("   Please create Lists first using 'create-lists' command.");
        return;
      }

      const createdLists = new Map<string, CreatedList>();
      const addedRepoNames = new Set<string>();

      for (const list of listsData.lists) {
        createdLists.set(list.name, {
          id: list.id,
          name: list.name,
          description: list.description,
        });

        for (const repo of list.repositories) {
          addedRepoNames.add(`${repo.owner}/${repo.name}`);
        }
      }

      spinner.succeed(`${createdLists.size} Lists found`);

      // Step 2: Determine categories (--use-existing or plan file)
      let categories: Category[];

      if (options.useExisting) {
        // Use existing Lists as categories
        categories = listsData.lists.map((list) => ({
          name: list.name,
          description: list.description || "",
          keywords: [],
        }));
        console.log(`📋 Using existing ${categories.length} Lists as categories`);
      } else {
        // Load categories from plan file
        const plan = loadPlan();
        if (!plan) {
          console.log("❌ No saved plan found.");
          console.log("   Run 'plan' command or use --use-existing option.");
          return;
        }
        categories = plan.categories;
        console.log(`📋 Loaded ${categories.length} categories from plan`);
      }

      // Step 3: Fetch starred repos
      const repoSpinner = ora("Fetching starred repositories...").start();
      const result = await fetchAllMyStarredRepos(
        config.githubToken,
        config.githubUsername,
        (count) => {
          repoSpinner.text = `Fetching starred repositories... (${count})`;
        },
      );

      if (result.status !== 200 || !result.repos) {
        repoSpinner.fail("Failed to fetch starred repositories");
        throw new Error(`Failed to fetch starred repos: status ${result.status}`);
      }

      let repos = result.repos;
      repoSpinner.succeed(`Fetched ${repos.length} starred repositories.`);

      // Step 4: --only-new filtering
      if (options.onlyNew) {
        const beforeCount = repos.length;
        repos = repos.filter(
          (repo) => !addedRepoNames.has(`${repo.owner.login}/${repo.name}`),
        );
        const skipped = beforeCount - repos.length;
        console.log(`  → ${skipped} already added, ${repos.length} to process`);
      }

      if (repos.length === 0) {
        console.log("\n✅ No Stars to process.");
        return;
      }

      // Step 5: Batch classification and add
      await classifyAndAddRepos(config, gemini, repos, categories, createdLists);

      console.log("\n✅ Classification complete!");
    } catch (error) {
      console.error("\n❌ Error:", (error as Error).message);
      process.exit(1);
    }
  });

async function classifyAndAddRepos(
  config: ReturnType<typeof loadConfig>,
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

async function handleReset(config: ReturnType<typeof loadConfig>) {
  console.log("\n🔄 Removing Stars from Lists.\n");

  // Check Lists
  const spinner = ora("Checking existing Lists...").start();
  const listsData = await fetchGitHubLists(config.githubUsername, config.githubToken);

  if (listsData.totalLists === 0) {
    spinner.fail("No Lists found.");
    return;
  }

  // Collect all repos in Lists
  const reposInLists = new Map<string, { owner: string; name: string }>();
  for (const list of listsData.lists) {
    for (const repo of list.repositories) {
      const key = `${repo.owner}/${repo.name}`;
      if (!reposInLists.has(key)) {
        reposInLists.set(key, { owner: repo.owner, name: repo.name });
      }
    }
  }

  spinner.stop();

  if (reposInLists.size === 0) {
    console.log("No repositories added to Lists.");
    return;
  }

  console.log(`Found ${reposInLists.size} repositories in ${listsData.totalLists} Lists`);

  const confirmed = await confirm({
    message: `Remove ${reposInLists.size} repositories from all Lists?`,
    default: false,
  });

  if (!confirmed) {
    console.log("Cancelled.");
    return;
  }

  // Execute removal
  const removeSpinner = ora(`Removing from Lists... (0/${reposInLists.size})`).start();
  let removed = 0;
  let failed = 0;

  for (const [key, repo] of reposInLists) {
    try {
      const repoNodeId = await getRepositoryNodeId(
        config.githubToken,
        repo.owner,
        repo.name,
      );
      await removeRepoFromAllLists(config.githubToken, repoNodeId);
      removed++;
      await delay(config.githubRequestDelay);
    } catch (error) {
      failed++;
    }
    removeSpinner.text = `Removing from Lists... (${removed + failed}/${reposInLists.size})`;
  }

  removeSpinner.succeed(`Removal complete`);
  console.log(`\n📊 Results:`);
  console.log(`  ✅ Success: ${removed}`);
  console.log(`  ❌ Failed: ${failed}`);
}
