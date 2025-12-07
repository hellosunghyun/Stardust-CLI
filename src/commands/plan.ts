import { Command } from "commander";
import ora from "ora";
import { loadConfig } from "../utils/config";
import { GeminiService } from "../services/gemini";
import { savePlan, loadPlan, deletePlan } from "../utils/plan-storage";
import { fetchAllMyStarredRepos } from "../api";
import type { RepoSummary } from "../types";

export const planCommand = new Command("plan")
  .description("Plan categories (analyze Stars and create categories)")
  .option("--show", "Show saved plan")
  .option("--delete", "Delete saved plan")
  .action(async (options) => {
    try {
      // --show: Show saved plan
      if (options.show) {
        const plan = loadPlan();
        if (!plan) {
          console.log("\nNo saved plan found. Run 'plan' command first.");
          return;
        }
        displayPlan(plan.categories, plan.repoCount, plan.createdAt);
        return;
      }

      // --delete: Delete saved plan
      if (options.delete) {
        if (deletePlan()) {
          console.log("\n✅ Saved plan has been deleted.");
        } else {
          console.log("\nNo saved plan found.");
        }
        return;
      }

      // Default: Create new plan
      const config = loadConfig();
      const gemini = new GeminiService(config);

      console.log("\n🎯 Starting category planning.\n");

      // Step 1: Fetch starred repos
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

      const repos = result.repos;
      spinner.succeed(`Fetched ${repos.length} starred repositories.`);

      // Step 2: AI category planning
      const planSpinner = ora(`AI is planning ${config.maxCategories} categories...`).start();

      const repoSummaries: RepoSummary[] = repos.map((r) => ({
        owner: r.owner.login,
        name: r.name,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count,
      }));

      const categories = await gemini.planCategories(repoSummaries);
      planSpinner.succeed(`${categories.length} categories have been planned.`);

      // Step 3: Save plan
      savePlan(categories, repos.length);
      console.log("\n💾 Plan has been saved. (.startidy-plan.json)");

      // Step 4: Display results
      displayPlan(categories, repos.length, new Date().toISOString());

      console.log("\n📌 Next steps:");
      console.log("  1. Delete existing Lists: startidy lists --delete-all");
      console.log("  2. Create Lists: startidy create-lists");
      console.log("  3. Classify Stars: startidy classify");
      console.log("\n  Or run full automation: startidy run");
    } catch (error) {
      console.error("\n❌ Error:", (error as Error).message);
      process.exit(1);
    }
  });

function displayPlan(
  categories: { name: string; description: string }[],
  repoCount: number,
  createdAt: string,
) {
  console.log("\n📋 Planned Categories:\n");
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
  console.log(`  - Created at: ${new Date(createdAt).toLocaleString()}`);
}
