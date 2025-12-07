import { Command } from "commander";
import ora from "ora";
import { loadConfig } from "../utils/config";
import { loadPlan } from "../utils/plan-storage";
import { delay } from "../utils/rate-limiter";
import { createGitHubList, fetchGitHubLists } from "../api";

export const createListsCommand = new Command("create-lists")
  .description("Create GitHub Lists from planned categories")
  .option("--force", "Create additional Lists even if some exist")
  .action(async (options) => {
    try {
      const config = loadConfig();

      console.log("\n📁 Starting Lists creation.\n");

      // Step 1: Check saved plan
      const plan = loadPlan();
      if (!plan) {
        console.log("❌ No saved plan found.");
        console.log("   Please run 'plan' command first.");
        return;
      }

      console.log(`📋 Loaded ${plan.categories.length} categories from plan`);
      console.log(`   Created at: ${new Date(plan.createdAt).toLocaleString()}`);

      // Step 2: Check existing Lists
      if (!options.force) {
        const spinner = ora("Checking existing Lists...").start();
        const existing = await fetchGitHubLists(config.githubUsername, config.githubToken);
        spinner.stop();

        if (existing.totalLists > 0) {
          console.log(`\n⚠️ ${existing.totalLists} Lists already exist.`);
          console.log("   Use --force to create additional Lists, or");
          console.log("   use 'lists --delete-all' to delete existing ones first.");
          return;
        }
      }

      // Step 3: Create Lists
      const spinner = ora("Creating Lists...").start();
      let created = 0;
      let failed = 0;

      for (const category of plan.categories) {
        try {
          await createGitHubList(
            config.githubToken,
            category.name,
            category.description,
            config.listIsPrivate,
          );

          created++;
          spinner.text = `Creating Lists... (${created}/${plan.categories.length})`;

          await delay(config.listCreateDelay);
        } catch (error) {
          failed++;
          console.warn(`\n  ⚠️ Failed to create "${category.name}": ${(error as Error).message}`);
        }
      }

      spinner.succeed(`${created} Lists created`);

      if (failed > 0) {
        console.log(`  ⚠️ ${failed} failed`);
      }

      console.log("\n📌 Next step:");
      console.log("  Classify Stars: startidy classify");
    } catch (error) {
      console.error("\n❌ Error:", (error as Error).message);
      process.exit(1);
    }
  });
