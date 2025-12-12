import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import {
  GitHubAPIError,
  graphql,
  rest,
  restPaginated,
} from "../../src/api/client";

describe("api/client", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("GitHubAPIError", () => {
    it("should create error with message only", () => {
      const error = new GitHubAPIError("Test error");

      expect(error.message).toBe("Test error");
      expect(error.name).toBe("GitHubAPIError");
      expect(error.statusCode).toBeUndefined();
      expect(error.errors).toBeUndefined();
    });

    it("should create error with status code", () => {
      const error = new GitHubAPIError("Not found", 404);

      expect(error.message).toBe("Not found");
      expect(error.statusCode).toBe(404);
    });

    it("should create error with errors array", () => {
      const errors = [{ message: "Error 1" }, { message: "Error 2" }];
      const error = new GitHubAPIError("Multiple errors", undefined, errors);

      expect(error.errors).toEqual(errors);
    });

    it("should be instanceof Error", () => {
      const error = new GitHubAPIError("Test");
      expect(error instanceof Error).toBe(true);
    });
  });

  describe("graphql", () => {
    it("should make successful GraphQL request", async () => {
      const mockData = { user: { name: "Test User" } };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockData }),
        } as Response)
      );

      const result = await graphql<typeof mockData>("test-token", "query { user { name } }");

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should include authorization header", async () => {
      let capturedHeaders: HeadersInit | undefined;

      global.fetch = mock((_, options) => {
        capturedHeaders = (options as RequestInit).headers;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: {} }),
        } as Response);
      });

      await graphql("my-secret-token", "query {}");

      expect(capturedHeaders).toBeDefined();
      expect((capturedHeaders as Record<string, string>)["Authorization"]).toBe(
        "Bearer my-secret-token"
      );
    });

    it("should pass variables in request body", async () => {
      let capturedBody: string | undefined;

      global.fetch = mock((_, options) => {
        capturedBody = (options as RequestInit).body as string;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: {} }),
        } as Response);
      });

      await graphql("token", "query ($id: ID!) { node(id: $id) }", { id: "123" });

      const body = JSON.parse(capturedBody!);
      expect(body.variables).toEqual({ id: "123" });
    });

    it("should throw GitHubAPIError on non-ok response", async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          text: () => Promise.resolve("Unauthorized"),
        } as Response)
      );

      await expect(graphql("bad-token", "query {}")).rejects.toThrow(GitHubAPIError);
    });

    it("should throw GitHubAPIError on GraphQL errors", async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              errors: [{ message: "Field not found" }],
            }),
        } as Response)
      );

      await expect(graphql("token", "query { invalid }")).rejects.toThrow(
        "GraphQL Error"
      );
    });

    it("should throw GitHubAPIError on empty data", async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response)
      );

      await expect(graphql("token", "query {}")).rejects.toThrow(
        "GitHub API returned empty data"
      );
    });
  });

  describe("rest", () => {
    it("should make successful REST request", async () => {
      const mockData = { id: 1, name: "repo" };

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockData),
        } as Response)
      );

      const result = await rest("token", "/repos/owner/repo");

      expect(result.data).toEqual(mockData);
      expect(result.status).toBe(200);
    });

    it("should prepend API URL to relative endpoints", async () => {
      let capturedUrl: string | undefined;

      global.fetch = mock((url) => {
        capturedUrl = url as string;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        } as Response);
      });

      await rest("token", "/user/repos");

      expect(capturedUrl).toBe("https://api.github.com/user/repos");
    });

    it("should use full URL when provided", async () => {
      let capturedUrl: string | undefined;

      global.fetch = mock((url) => {
        capturedUrl = url as string;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        } as Response);
      });

      await rest("token", "https://custom.api.com/endpoint");

      expect(capturedUrl).toBe("https://custom.api.com/endpoint");
    });

    it("should merge custom options", async () => {
      let capturedOptions: RequestInit | undefined;

      global.fetch = mock((_, options) => {
        capturedOptions = options as RequestInit;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        } as Response);
      });

      await rest("token", "/endpoint", { method: "POST" });

      expect(capturedOptions?.method).toBe("POST");
    });

    it("should throw GitHubAPIError on failure", async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          text: () => Promise.resolve("Not found"),
        } as Response)
      );

      await expect(rest("token", "/notfound")).rejects.toThrow(GitHubAPIError);
    });
  });

  describe("restPaginated", () => {
    it("should fetch single page", async () => {
      const mockItems = [{ id: 1 }, { id: 2 }];

      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockItems),
        } as Response)
      );

      const result = await restPaginated<{ id: number }>("token", "/items");

      expect(result).toEqual(mockItems);
    });

    it("should fetch multiple pages", async () => {
      const page1 = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const page2 = [{ id: 100 }, { id: 101 }];
      let callCount = 0;

      global.fetch = mock(() => {
        callCount++;
        const items = callCount === 1 ? page1 : page2;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(items),
        } as Response);
      });

      const result = await restPaginated<{ id: number }>("token", "/items");

      expect(result.length).toBe(102);
      expect(callCount).toBe(2);
    });

    it("should call onProgress callback", async () => {
      const page1 = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const page2 = [{ id: 100 }];
      let callCount = 0;
      const progressCalls: number[] = [];

      global.fetch = mock(() => {
        callCount++;
        const items = callCount === 1 ? page1 : page2;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(items),
        } as Response);
      });

      await restPaginated<{ id: number }>("token", "/items", (count) => {
        progressCalls.push(count);
      });

      expect(progressCalls).toEqual([100, 101]);
    });

    it("should handle endpoint with existing query params", async () => {
      let capturedUrl: string | undefined;

      global.fetch = mock((url) => {
        capturedUrl = url as string;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
        } as Response);
      });

      await restPaginated("token", "/items?sort=updated");

      expect(capturedUrl).toContain("&page=1");
      expect(capturedUrl).not.toContain("?page=");
    });
  });
});
