import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import type { Category, RepoDetail, RepoSummary } from "../../src/types";
import type { Config } from "../../src/utils/config";
import type { BatchRepoInfo } from "../../src/prompts/classifier";

// Mock the @google/genai module
const mockGenerateContent = mock(() =>
  Promise.resolve({
    text: JSON.stringify({
      categories: [
        { name: "Lang: Python", description: "Python projects" },
        { name: "AI: LLM", description: "LLM projects" },
      ],
    }),
  })
);

const mockModels = {
  generateContent: mockGenerateContent,
};

// We need to test the parsing logic directly since mocking ES modules is complex
describe("services/gemini parsing logic", () => {
  const mockConfig: Config = {
    githubToken: "test-token",
    githubUsername: "testuser",
    geminiApiKey: "test-key",
    maxCategories: 32,
    maxCategoriesPerRepo: 3,
    minCategoriesPerRepo: 1,
    classifyBatchSize: 20,
    readmeBatchSize: 20,
    listCreateDelay: 500,
    batchDelay: 2000,
    geminiRpm: 15,
    githubRequestDelay: 100,
    geminiModel: "gemini-2.5-flash",
    geminiTemperaturePlanning: 0.7,
    geminiTemperatureClassify: 0.3,
    geminiMaxTokensPlanning: 65536,
    geminiMaxTokensClassify: 65536,
    readmeMaxLength: 500,
    readmeMaxLengthSingle: 2000,
    listIsPrivate: false,
    listNameMaxLength: 20,
    maxRetries: 3,
    retryDelay: 1000,
    debug: false,
    logApiResponses: false,
  };

  const mockCategories: Category[] = [
    { name: "Lang: Python", description: "Python projects", keywords: [] },
    { name: "AI: LLM", description: "LLM projects", keywords: [] },
    { name: "Web: Frontend", description: "Frontend projects", keywords: [] },
  ];

  describe("parseBatchClassifierResponse logic", () => {
    // Test the parsing logic that would be used in GeminiService
    function parseBatchClassifierResponse(
      text: string,
      repos: BatchRepoInfo[],
      categories: Category[],
      maxCategoriesPerRepo: number
    ): Map<string, string[]> {
      const resultMap = new Map<string, string[]>();
      const validCategoryNames = new Set(categories.map((c) => c.name));
      const defaultCategory = categories[0]?.name || "Lang: ETC";

      try {
        let jsonStr = text.trim();

        // Attempt to recover truncated JSON
        if (!jsonStr.endsWith("}")) {
          const openBraces = (jsonStr.match(/\{/g) || []).length;
          const closeBraces = (jsonStr.match(/\}/g) || []).length;
          const openBrackets = (jsonStr.match(/\[/g) || []).length;
          const closeBrackets = (jsonStr.match(/\]/g) || []).length;

          const lastCompleteIdx = jsonStr.lastIndexOf("}");
          if (lastCompleteIdx > 0) {
            const afterLast = jsonStr.slice(lastCompleteIdx + 1);
            if (afterLast.includes("{") && !afterLast.includes("}")) {
              jsonStr = jsonStr.slice(0, lastCompleteIdx + 1);
            }
          }

          jsonStr += "]".repeat(Math.max(0, openBrackets - closeBrackets));
          jsonStr += "}".repeat(Math.max(0, openBraces - closeBraces));
        }

        const parsed = JSON.parse(jsonStr);

        if (!parsed.results || !Array.isArray(parsed.results)) {
          throw new Error("Invalid response structure");
        }

        for (const result of parsed.results) {
          if (!result.id || !Array.isArray(result.categories)) continue;

          const validCategories = result.categories
            .filter((c: string) => validCategoryNames.has(c))
            .slice(0, maxCategoriesPerRepo);

          resultMap.set(
            result.id,
            validCategories.length > 0 ? validCategories : [defaultCategory]
          );
        }

        for (const repo of repos) {
          if (!resultMap.has(repo.id)) {
            resultMap.set(repo.id, [defaultCategory]);
          }
        }
      } catch {
        // Fallback: try to extract individual patterns
        const linePattern =
          /"id"\s*:\s*"([^"]+)"[^}]*"categories"\s*:\s*\[([^\]]*)\]/g;
        let match;
        while ((match = linePattern.exec(text)) !== null) {
          const id = match[1];
          const categoriesStr = match[2];
          const cats = categoriesStr
            .split(",")
            .map((s) => s.trim().replace(/"/g, ""))
            .filter((c) => validCategoryNames.has(c))
            .slice(0, maxCategoriesPerRepo);

          if (cats.length > 0 && !resultMap.has(id)) {
            resultMap.set(id, cats);
          }
        }

        for (const repo of repos) {
          if (!resultMap.has(repo.id)) {
            resultMap.set(repo.id, [defaultCategory]);
          }
        }
      }

      return resultMap;
    }

    it("should parse valid JSON response", () => {
      const text = JSON.stringify({
        results: [
          { id: "owner1/repo1", categories: ["Lang: Python", "AI: LLM"] },
          { id: "owner2/repo2", categories: ["Web: Frontend"] },
        ],
      });

      const repos: BatchRepoInfo[] = [
        { id: "owner1/repo1", description: "t", language: "Python", stars: 1, readme: null },
        { id: "owner2/repo2", description: "t", language: "JS", stars: 2, readme: null },
      ];

      const result = parseBatchClassifierResponse(text, repos, mockCategories, 3);

      expect(result.get("owner1/repo1")).toEqual(["Lang: Python", "AI: LLM"]);
      expect(result.get("owner2/repo2")).toEqual(["Web: Frontend"]);
    });

    it("should filter invalid categories", () => {
      const text = JSON.stringify({
        results: [
          { id: "owner/repo", categories: ["Lang: Python", "Invalid: Category", "AI: LLM"] },
        ],
      });

      const repos: BatchRepoInfo[] = [
        { id: "owner/repo", description: "t", language: "Python", stars: 1, readme: null },
      ];

      const result = parseBatchClassifierResponse(text, repos, mockCategories, 3);

      expect(result.get("owner/repo")).toEqual(["Lang: Python", "AI: LLM"]);
    });

    it("should respect maxCategoriesPerRepo limit", () => {
      const text = JSON.stringify({
        results: [
          { id: "owner/repo", categories: ["Lang: Python", "AI: LLM", "Web: Frontend"] },
        ],
      });

      const repos: BatchRepoInfo[] = [
        { id: "owner/repo", description: "t", language: "Python", stars: 1, readme: null },
      ];

      const result = parseBatchClassifierResponse(text, repos, mockCategories, 2);

      expect(result.get("owner/repo")?.length).toBe(2);
    });

    it("should use default category when no valid categories found", () => {
      const text = JSON.stringify({
        results: [{ id: "owner/repo", categories: ["Invalid: One", "Invalid: Two"] }],
      });

      const repos: BatchRepoInfo[] = [
        { id: "owner/repo", description: "t", language: "Python", stars: 1, readme: null },
      ];

      const result = parseBatchClassifierResponse(text, repos, mockCategories, 3);

      expect(result.get("owner/repo")).toEqual(["Lang: Python"]);
    });

    it("should assign default category to missing repos", () => {
      const text = JSON.stringify({
        results: [{ id: "owner/repo1", categories: ["AI: LLM"] }],
      });

      const repos: BatchRepoInfo[] = [
        { id: "owner/repo1", description: "t", language: "Python", stars: 1, readme: null },
        { id: "owner/repo2", description: "t", language: "JS", stars: 2, readme: null },
      ];

      const result = parseBatchClassifierResponse(text, repos, mockCategories, 3);

      expect(result.get("owner/repo1")).toEqual(["AI: LLM"]);
      expect(result.get("owner/repo2")).toEqual(["Lang: Python"]);
    });

    it("should handle truncated JSON", () => {
      // Simulate truncated response
      const text = `{"results": [{"id": "owner/repo1", "categories": ["Lang: Python"]}, {"id": "owner/repo2", "categories": ["AI: LLM"`;

      const repos: BatchRepoInfo[] = [
        { id: "owner/repo1", description: "t", language: "Python", stars: 1, readme: null },
        { id: "owner/repo2", description: "t", language: "JS", stars: 2, readme: null },
      ];

      const result = parseBatchClassifierResponse(text, repos, mockCategories, 3);

      // Should at least recover repo1
      expect(result.has("owner/repo1")).toBe(true);
      // repo2 should have default
      expect(result.get("owner/repo2")).toBeDefined();
    });

    it("should handle completely invalid JSON with fallback regex", () => {
      const text = `Some random text "id": "owner/repo1" "categories": ["Lang: Python", "AI: LLM"] more text`;

      const repos: BatchRepoInfo[] = [
        { id: "owner/repo1", description: "t", language: "Python", stars: 1, readme: null },
      ];

      const result = parseBatchClassifierResponse(text, repos, mockCategories, 3);

      // Should fall back to default for all repos
      expect(result.has("owner/repo1")).toBe(true);
    });

    it("should skip results without id or categories", () => {
      const text = JSON.stringify({
        results: [
          { id: "owner/repo1", categories: ["Lang: Python"] },
          { categories: ["AI: LLM"] }, // Missing id
          { id: "owner/repo2" }, // Missing categories
          { id: "owner/repo3", categories: ["Web: Frontend"] },
        ],
      });

      const repos: BatchRepoInfo[] = [
        { id: "owner/repo1", description: "t", language: "Python", stars: 1, readme: null },
        { id: "owner/repo2", description: "t", language: "JS", stars: 2, readme: null },
        { id: "owner/repo3", description: "t", language: "Go", stars: 3, readme: null },
      ];

      const result = parseBatchClassifierResponse(text, repos, mockCategories, 3);

      expect(result.get("owner/repo1")).toEqual(["Lang: Python"]);
      expect(result.get("owner/repo2")).toEqual(["Lang: Python"]); // Default
      expect(result.get("owner/repo3")).toEqual(["Web: Frontend"]);
    });
  });

  describe("parseClassifierResponse logic", () => {
    function parseClassifierResponse(
      text: string,
      categories: Category[],
      maxCategoriesPerRepo: number
    ): { categories: string[]; reason: string } {
      try {
        const parsed = JSON.parse(text.trim());

        if (!parsed.categories || !Array.isArray(parsed.categories)) {
          throw new Error("Invalid response structure");
        }

        const validCategoryNames = new Set(categories.map((c) => c.name));
        const validatedCategories = parsed.categories
          .filter((c: string) => validCategoryNames.has(c))
          .slice(0, maxCategoriesPerRepo);

        if (validatedCategories.length === 0) {
          validatedCategories.push(categories[0].name);
        }

        return {
          categories: validatedCategories,
          reason: "",
        };
      } catch {
        return {
          categories: [categories[0].name],
          reason: "Parsing failed, using default category",
        };
      }
    }

    it("should parse valid single classification response", () => {
      const text = JSON.stringify({
        categories: ["Lang: Python", "AI: LLM"],
      });

      const result = parseClassifierResponse(text, mockCategories, 3);

      expect(result.categories).toEqual(["Lang: Python", "AI: LLM"]);
      expect(result.reason).toBe("");
    });

    it("should filter invalid categories", () => {
      const text = JSON.stringify({
        categories: ["Lang: Python", "Invalid", "AI: LLM"],
      });

      const result = parseClassifierResponse(text, mockCategories, 3);

      expect(result.categories).toEqual(["Lang: Python", "AI: LLM"]);
    });

    it("should respect maxCategoriesPerRepo", () => {
      const text = JSON.stringify({
        categories: ["Lang: Python", "AI: LLM", "Web: Frontend"],
      });

      const result = parseClassifierResponse(text, mockCategories, 2);

      expect(result.categories.length).toBe(2);
    });

    it("should use default when all categories invalid", () => {
      const text = JSON.stringify({
        categories: ["Invalid1", "Invalid2"],
      });

      const result = parseClassifierResponse(text, mockCategories, 3);

      expect(result.categories).toEqual(["Lang: Python"]);
    });

    it("should handle invalid JSON", () => {
      const text = "not valid json";

      const result = parseClassifierResponse(text, mockCategories, 3);

      expect(result.categories).toEqual(["Lang: Python"]);
      expect(result.reason).toContain("Parsing failed");
    });

    it("should handle missing categories field", () => {
      const text = JSON.stringify({ other: "data" });

      const result = parseClassifierResponse(text, mockCategories, 3);

      expect(result.categories).toEqual(["Lang: Python"]);
      expect(result.reason).toContain("Parsing failed");
    });

    it("should handle empty categories array", () => {
      const text = JSON.stringify({ categories: [] });

      const result = parseClassifierResponse(text, mockCategories, 3);

      expect(result.categories).toEqual(["Lang: Python"]);
    });

    it("should handle whitespace in JSON", () => {
      const text = `
        {
          "categories": ["Lang: Python", "AI: LLM"]
        }
      `;

      const result = parseClassifierResponse(text, mockCategories, 3);

      expect(result.categories).toEqual(["Lang: Python", "AI: LLM"]);
    });
  });

  describe("category planning parsing", () => {
    function parseCategoryResponse(
      text: string
    ): { name: string; description: string; keywords: string[] }[] {
      try {
        const parsed = JSON.parse(text);
        return parsed.categories.map(
          (c: { name: string; description: string }) => ({
            name: c.name || "Unnamed",
            description: c.description || "",
            keywords: [],
          })
        );
      } catch {
        throw new Error("Failed to parse Gemini category response");
      }
    }

    it("should parse valid category planning response", () => {
      const text = JSON.stringify({
        categories: [
          { name: "Lang: Python", description: "Python projects" },
          { name: "AI: LLM", description: "LLM and chatbot projects" },
        ],
      });

      const result = parseCategoryResponse(text);

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({
        name: "Lang: Python",
        description: "Python projects",
        keywords: [],
      });
      expect(result[1]).toEqual({
        name: "AI: LLM",
        description: "LLM and chatbot projects",
        keywords: [],
      });
    });

    it("should handle missing name", () => {
      const text = JSON.stringify({
        categories: [{ description: "No name category" }],
      });

      const result = parseCategoryResponse(text);

      expect(result[0].name).toBe("Unnamed");
    });

    it("should handle missing description", () => {
      const text = JSON.stringify({
        categories: [{ name: "Lang: Go" }],
      });

      const result = parseCategoryResponse(text);

      expect(result[0].description).toBe("");
    });

    it("should throw on invalid JSON", () => {
      expect(() => parseCategoryResponse("invalid")).toThrow(
        "Failed to parse Gemini category response"
      );
    });

    it("should always set keywords to empty array", () => {
      const text = JSON.stringify({
        categories: [{ name: "Test", description: "Test desc" }],
      });

      const result = parseCategoryResponse(text);

      expect(result[0].keywords).toEqual([]);
    });
  });
});
