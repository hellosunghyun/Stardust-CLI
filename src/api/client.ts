/**
 * GitHub API Client
 * Provides a unified interface for GitHub REST and GraphQL API calls
 */

const GITHUB_API_URL = "https://api.github.com";
const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const USER_AGENT = "Stardust-CLI";

export interface GitHubClientConfig {
  token: string;
}

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string; type?: string; path?: string[] }>;
}

export class GitHubAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errors?: Array<{ message: string }>,
  ) {
    super(message);
    this.name = "GitHubAPIError";
  }
}

/**
 * Execute a GitHub GraphQL query
 */
export async function graphql<T = unknown>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new GitHubAPIError(
      `GitHub API request failed (${response.status}): ${errorText}`,
      response.status,
    );
  }

  const result: GraphQLResponse<T> = await response.json();

  if (result.errors) {
    throw new GitHubAPIError(
      `GraphQL Error: ${result.errors.map((e) => e.message).join(", ")}`,
      undefined,
      result.errors,
    );
  }

  if (!result.data) {
    throw new GitHubAPIError("GitHub API returned empty data");
  }

  return result.data;
}

/**
 * Execute a GitHub REST API request
 */
export async function rest<T = unknown>(
  token: string,
  endpoint: string,
  options: RequestInit = {},
): Promise<{ data: T; status: number }> {
  const url = endpoint.startsWith("http") ? endpoint : `${GITHUB_API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "User-Agent": USER_AGENT,
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new GitHubAPIError(
      `GitHub API request failed (${response.status}): ${errorText}`,
      response.status,
    );
  }

  const data: T = await response.json();
  return { data, status: response.status };
}

/**
 * Paginated REST API request - fetches all pages
 */
export async function restPaginated<T>(
  token: string,
  endpoint: string,
  onProgress?: (count: number) => void,
): Promise<T[]> {
  const allItems: T[] = [];
  let page = 1;

  while (true) {
    const separator = endpoint.includes("?") ? "&" : "?";
    const paginatedEndpoint = `${endpoint}${separator}page=${page}&per_page=100`;

    const { data: items } = await rest<T[]>(token, paginatedEndpoint);
    allItems.push(...items);

    onProgress?.(allItems.length);

    if (items.length < 100) {
      break;
    }
    page++;
  }

  return allItems;
}
