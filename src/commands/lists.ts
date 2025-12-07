import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import ora from "ora";
import { loadConfig } from "../utils/config";
import {
  fetchGitHubLists,
  deleteAllGitHubLists,
  deleteGitHubList,
  createGitHubList,
} from "../api";

export const listsCommand = new Command("lists")
  .description("Manage GitHub Lists")
  .option("--show", "Show all Lists (default)")
  .option("--delete-all", "Delete all Lists")
  .option("--create <name>", "Create a new List")
  .option("--delete <name>", "Delete a specific List")
  .option("-d, --description <desc>", "List description (use with --create)")
  .action(async (options) => {
    try {
      const config = loadConfig();

      if (options.deleteAll) {
        await handleDeleteAll(config);
      } else if (options.create) {
        await handleCreate(config, options.create, options.description);
      } else if (options.delete) {
        await handleDelete(config, options.delete);
      } else {
        await showAllLists(config);
      }
    } catch (error) {
      console.error("Error:", (error as Error).message);
      process.exit(1);
    }
  });

async function showAllLists(config: {
  githubToken: string;
  githubUsername: string;
}) {
  const spinner = ora("Fetching Lists...").start();

  try {
    const data = await fetchGitHubLists(config.githubUsername, config.githubToken);
    spinner.stop();

    if (data.totalLists === 0) {
      console.log("\nNo Lists found.");
      return;
    }

    console.log(`\n📋 Total ${data.totalLists} Lists:\n`);
    console.log("─".repeat(70));

    for (const list of data.lists) {
      const repoCount = list.totalRepositories.toString().padStart(3);
      const visibility = list.isPrivate ? "🔒" : "🌐";
      console.log(`${visibility} ${list.name}`);
      console.log(`   Description: ${list.description || "(none)"}`);
      console.log(`   Repositories: ${repoCount}`);
      console.log("─".repeat(70));
    }
  } catch (error) {
    spinner.fail("Failed to fetch Lists");
    throw error;
  }
}

async function handleCreate(
  config: { githubToken: string },
  name: string,
  description?: string,
) {
  const spinner = ora(`Creating "${name}" List...`).start();

  try {
    const result = await createGitHubList(
      config.githubToken,
      name,
      description,
      false,
    );
    spinner.succeed(`"${result.list.name}" List has been created.`);
  } catch (error) {
    spinner.fail("Failed to create List");
    throw error;
  }
}

async function handleDelete(
  config: { githubToken: string; githubUsername: string },
  name: string,
) {
  const spinner = ora("Searching for List...").start();

  const data = await fetchGitHubLists(config.githubUsername, config.githubToken);
  const list = data.lists.find(
    (l) => l.name.toLowerCase() === name.toLowerCase(),
  );

  if (!list) {
    spinner.fail(`"${name}" List not found.`);
    return;
  }

  spinner.stop();

  const confirmed = await confirm({
    message: `Delete "${list.name}" (${list.totalRepositories} repositories)?`,
    default: false,
  });

  if (!confirmed) {
    console.log("Cancelled.");
    return;
  }

  const deleteSpinner = ora("Deleting...").start();

  try {
    await deleteGitHubList(config.githubToken, list.id);
    deleteSpinner.succeed(`"${list.name}" List has been deleted.`);
  } catch (error) {
    deleteSpinner.fail("Failed to delete");
    throw error;
  }
}

async function handleDeleteAll(config: {
  githubToken: string;
  githubUsername: string;
}) {
  const spinner = ora("Checking current Lists...").start();
  const data = await fetchGitHubLists(config.githubUsername, config.githubToken);
  spinner.stop();

  if (data.totalLists === 0) {
    console.log("\nNo Lists to delete.");
    return;
  }

  console.log(`\nTotal ${data.totalLists} Lists:`);
  for (const list of data.lists) {
    console.log(`  - ${list.name} (${list.totalRepositories} repositories)`);
  }

  const confirmed = await confirm({
    message: `Are you sure you want to delete all ${data.totalLists} Lists?`,
    default: false,
  });

  if (!confirmed) {
    console.log("Cancelled.");
    return;
  }

  const deleteSpinner = ora(`Deleting Lists... (0/${data.totalLists})`).start();

  try {
    const deletedCount = await deleteAllGitHubLists(
      config.githubUsername,
      config.githubToken,
      (deleted, total) => {
        deleteSpinner.text = `Deleting Lists... (${deleted}/${total})`;
      },
    );
    deleteSpinner.succeed(`${deletedCount} Lists have been deleted.`);
  } catch (error) {
    deleteSpinner.fail("Failed to delete some Lists");
    throw error;
  }
}
