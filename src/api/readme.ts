import { graphql, GitHubAPIError } from "./client";
import { retryWithBackoff } from "../utils/rate-limiter";

interface ReadmeResponse {
  repository: {
    readme0?: { text: string } | null;
    readme1?: { text: string } | null;
    readme2?: { text: string } | null;
    readme3?: { text: string } | null;
    readme4?: { text: string } | null;
    readme5?: { text: string } | null;
  } | null;
}

const README_VARIANTS = [
  "HEAD:README.md",
  "HEAD:readme.md",
  "HEAD:README.MD",
  "HEAD:Readme.md",
  "HEAD:README",
  "HEAD:readme",
];

/**
 * Fetches the README content for a repository
 */
export async function fetchRepositoryReadme(
  token: string,
  owner: string,
  name: string,
): Promise<string | null> {
  if (!owner || !name) {
    throw new Error("Missing repository owner or name parameter");
  }

  try {
    // Build query with all README variants
    const query = `
      query FetchReadme($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          ${README_VARIANTS.map(
            (variant, i) => `
          readme${i}: object(expression: "${variant}") {
            ... on Blob {
              text
            }
          }`,
          ).join("\n")}
        }
      }
    `;

    const data = await retryWithBackoff(
      () => graphql<ReadmeResponse>(token, query, { owner, name }),
      { maxRetries: 3, initialDelayMs: 1000, maxDelayMs: 10000 },
    );

    const repo = data.repository;
    if (!repo) {
      return null;
    }

    // Return first found README
    for (let i = 0; i < README_VARIANTS.length; i++) {
      const readme = repo[`readme${i}` as keyof typeof repo];
      if (readme?.text) {
        return readme.text;
      }
    }

    return null;
  } catch (error) {
    // Log warning but don't fail - README is optional
    if (error instanceof GitHubAPIError) {
      console.warn(`Warning: Could not fetch README for ${owner}/${name}`);
    }
    return null;
  }
}
