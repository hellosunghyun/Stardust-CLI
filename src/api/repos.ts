import { graphql, restPaginated, GitHubAPIError } from "./client";
import type { Repo } from "./types";

export type ProgressCallback = (current: number, message?: string) => void;

/**
 * Fetches all repositories owned by the authenticated user
 */
export async function fetchAllMyRepos(
  token: string,
  owner: string,
  onProgress?: ProgressCallback,
): Promise<{ repos?: Repo[]; status: number }> {
  try {
    const repos = await restPaginated<Repo>(
      token,
      "/user/repos?sort=updated",
      onProgress,
    );
    return { status: 200, repos };
  } catch (error) {
    if (error instanceof GitHubAPIError && error.statusCode) {
      return { status: error.statusCode };
    }
    throw error;
  }
}

/**
 * Fetches all starred repositories for the authenticated user
 */
export async function fetchAllMyStarredRepos(
  token: string,
  owner: string,
  onProgress?: ProgressCallback,
): Promise<{ repos?: Repo[]; status: number }> {
  try {
    const repos = await restPaginated<Repo>(
      token,
      "/user/starred?sort=updated",
      onProgress,
    );
    return { status: 200, repos };
  } catch (error) {
    if (error instanceof GitHubAPIError && error.statusCode) {
      return { status: error.statusCode };
    }
    throw error;
  }
}

interface RepositoryNodeIdResponse {
  repository: {
    id: string;
  } | null;
}

/**
 * Gets the Node ID for a repository (needed for list operations)
 */
export async function getRepositoryNodeId(
  token: string,
  owner: string,
  name: string,
): Promise<string> {
  if (!owner || !name) {
    throw new Error("Missing repository owner or name parameter");
  }

  const query = `
    query GetRepositoryNodeId($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        id
      }
    }
  `;

  const data = await graphql<RepositoryNodeIdResponse>(token, query, { owner, name });

  if (!data.repository?.id) {
    throw new Error("Repository not found or ID not available");
  }

  return data.repository.id;
}
