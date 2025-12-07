import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import ora from "ora";
import { loadConfig } from "../utils/config";
import { loadPlan } from "../utils/plan-storage";
import { delay } from "../utils/rate-limiter";
import { GeminiService } from "../services/gemini";
import { classifyAndAddRepos } from "../services/classifier";
import type { Category, CreatedList } from "../types";
import {
  fetchAllMyStarredRepos,
  fetchGitHubLists,
  getRepositoryNodeId,
  removeRepoFromAllLists,
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

  for (const [, repo] of reposInLists) {
    try {
      const repoNodeId = await getRepositoryNodeId(
        config.githubToken,
        repo.owner,
        repo.name,
      );
      await removeRepoFromAllLists(config.githubToken, repoNodeId);
      removed++;
      await delay(config.githubRequestDelay);
    } catch {
      failed++;
    }
    removeSpinner.text = `Removing from Lists... (${removed + failed}/${reposInLists.size})`;
  }

  removeSpinner.succeed("Removal complete");
  console.log("\n📊 Results:");
  console.log(`  ✅ Success: ${removed}`);
  console.log(`  ❌ Failed: ${failed}`);
}
