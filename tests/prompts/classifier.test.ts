import { describe, it, expect } from "bun:test";
import {
  buildBatchClassifierPrompt,
  buildClassifierPrompt,
  type BatchRepoInfo,
} from "../../src/prompts/classifier";
import type { Category, RepoDetail } from "../../src/types";
import type { Config } from "../../src/utils/config";

describe("prompts/classifier", () => {
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
    { name: "Lang: Python", description: "Python projects", keywords: ["python", "py"] },
    { name: "AI: LLM", description: "Large language models", keywords: ["llm", "gpt"] },
    { name: "Web: Frontend", description: "Frontend development", keywords: ["react", "vue"] },
  ];

  describe("buildBatchClassifierPrompt", () => {
    it("should include all repositories", () => {
      const repos: BatchRepoInfo[] = [
        {
          id: "owner1/repo1",
          description: "First repo",
          language: "Python",
          stars: 1000,
          readme: "README content",
        },
        {
          id: "owner2/repo2",
          description: "Second repo",
          language: "JavaScript",
          stars: 2000,
          readme: null,
        },
      ];

      const prompt = buildBatchClassifierPrompt(repos, mockCategories, mockConfig);

      expect(prompt).toContain("owner1/repo1");
      expect(prompt).toContain("owner2/repo2");
      expect(prompt).toContain("First repo");
      expect(prompt).toContain("Second repo");
    });

    it("should include all categories", () => {
      const repos: BatchRepoInfo[] = [
        { id: "o/r", description: "test", language: "Go", stars: 100, readme: null },
      ];

      const prompt = buildBatchClassifierPrompt(repos, mockCategories, mockConfig);

      expect(prompt).toContain("Lang: Python");
      expect(prompt).toContain("AI: LLM");
      expect(prompt).toContain("Web: Frontend");
      expect(prompt).toContain("Python projects");
      expect(prompt).toContain("Large language models");
    });

    it("should truncate README to readmeMaxLength", () => {
      const longReadme = "A".repeat(1000);
      const repos: BatchRepoInfo[] = [
        {
          id: "o/r",
          description: "test",
          language: "Go",
          stars: 100,
          readme: longReadme,
        },
      ];

      const configWith500 = { ...mockConfig, readmeMaxLength: 500 };
      const prompt = buildBatchClassifierPrompt(repos, mockCategories, configWith500);

      // Should contain truncated README (500 chars)
      expect(prompt).toContain("A".repeat(500));
      expect(prompt).not.toContain("A".repeat(501));
    });

    it("should handle repos without description", () => {
      const repos: BatchRepoInfo[] = [
        { id: "o/r", description: null, language: "Go", stars: 100, readme: null },
      ];

      const prompt = buildBatchClassifierPrompt(repos, mockCategories, mockConfig);

      expect(prompt).toContain("Description: None");
    });

    it("should handle repos without language", () => {
      const repos: BatchRepoInfo[] = [
        { id: "o/r", description: "test", language: null, stars: 100, readme: null },
      ];

      const prompt = buildBatchClassifierPrompt(repos, mockCategories, mockConfig);

      expect(prompt).toContain("Language: None");
    });

    it("should handle repos without README", () => {
      const repos: BatchRepoInfo[] = [
        { id: "o/r", description: "test", language: "Go", stars: 100, readme: null },
      ];

      const prompt = buildBatchClassifierPrompt(repos, mockCategories, mockConfig);

      expect(prompt).toContain("README: None");
    });

    it("should include category counts in requirements", () => {
      const repos: BatchRepoInfo[] = [
        { id: "o/r", description: "test", language: "Go", stars: 100, readme: null },
      ];

      const customConfig = {
        ...mockConfig,
        minCategoriesPerRepo: 2,
        maxCategoriesPerRepo: 5,
      };
      const prompt = buildBatchClassifierPrompt(repos, mockCategories, customConfig);

      expect(prompt).toContain("at least 2, maximum 5");
    });

    it("should include repo count in prompt", () => {
      const repos: BatchRepoInfo[] = [
        { id: "o/r1", description: "t1", language: "Go", stars: 1, readme: null },
        { id: "o/r2", description: "t2", language: "Go", stars: 2, readme: null },
        { id: "o/r3", description: "t3", language: "Go", stars: 3, readme: null },
      ];

      const prompt = buildBatchClassifierPrompt(repos, mockCategories, mockConfig);

      expect(prompt).toContain("3 GitHub repositories");
      expect(prompt).toContain("Classify all 3 repositories");
    });

    it("should include category count", () => {
      const repos: BatchRepoInfo[] = [
        { id: "o/r", description: "test", language: "Go", stars: 100, readme: null },
      ];

      const prompt = buildBatchClassifierPrompt(repos, mockCategories, mockConfig);

      expect(prompt).toContain(`Available Categories (${mockCategories.length})`);
    });

    it("should replace newlines in README", () => {
      const repos: BatchRepoInfo[] = [
        {
          id: "o/r",
          description: "test",
          language: "Go",
          stars: 100,
          readme: "Line1\nLine2\nLine3",
        },
      ];

      const prompt = buildBatchClassifierPrompt(repos, mockCategories, mockConfig);

      expect(prompt).toContain("Line1 Line2 Line3");
      expect(prompt).not.toContain("Line1\n");
    });

    it("should number repositories correctly", () => {
      const repos: BatchRepoInfo[] = [
        { id: "o/r1", description: "t1", language: "Go", stars: 1, readme: null },
        { id: "o/r2", description: "t2", language: "Go", stars: 2, readme: null },
      ];

      const prompt = buildBatchClassifierPrompt(repos, mockCategories, mockConfig);

      expect(prompt).toContain("1. o/r1");
      expect(prompt).toContain("2. o/r2");
    });
  });

  describe("buildClassifierPrompt", () => {
    const mockRepoDetail: RepoDetail = {
      owner: "facebook",
      name: "react",
      description: "A JavaScript library for building user interfaces",
      language: "JavaScript",
      stars: 200000,
      readme: "# React\n\nA JavaScript library...",
    };

    it("should include repository information", () => {
      const prompt = buildClassifierPrompt(mockRepoDetail, mockCategories, mockConfig);

      expect(prompt).toContain("facebook/react");
      expect(prompt).toContain("A JavaScript library for building user interfaces");
      expect(prompt).toContain("JavaScript");
      expect(prompt).toContain("200000");
    });

    it("should include README content", () => {
      const prompt = buildClassifierPrompt(mockRepoDetail, mockCategories, mockConfig);

      expect(prompt).toContain("# React");
    });

    it("should truncate README to readmeMaxLengthSingle", () => {
      const longReadme = "X".repeat(5000);
      const repo: RepoDetail = {
        ...mockRepoDetail,
        readme: longReadme,
      };

      const prompt = buildClassifierPrompt(repo, mockCategories, mockConfig);

      expect(prompt).toContain("X".repeat(2000));
      expect(prompt).toContain("...");
    });

    it("should handle repo without README", () => {
      const repo: RepoDetail = {
        ...mockRepoDetail,
        readme: null,
      };

      const prompt = buildClassifierPrompt(repo, mockCategories, mockConfig);

      expect(prompt).toContain("No README");
    });

    it("should handle repo without description", () => {
      const repo: RepoDetail = {
        ...mockRepoDetail,
        description: null,
      };

      const prompt = buildClassifierPrompt(repo, mockCategories, mockConfig);

      expect(prompt).toContain("Description: None");
    });

    it("should handle repo without language", () => {
      const repo: RepoDetail = {
        ...mockRepoDetail,
        language: null,
      };

      const prompt = buildClassifierPrompt(repo, mockCategories, mockConfig);

      expect(prompt).toContain("Primary Language: None");
    });

    it("should include all categories with keywords", () => {
      const prompt = buildClassifierPrompt(mockRepoDetail, mockCategories, mockConfig);

      expect(prompt).toContain("Lang: Python");
      expect(prompt).toContain("python, py");
      expect(prompt).toContain("AI: LLM");
      expect(prompt).toContain("llm, gpt");
    });

    it("should number categories", () => {
      const prompt = buildClassifierPrompt(mockRepoDetail, mockCategories, mockConfig);

      expect(prompt).toContain("1. Lang: Python:");
      expect(prompt).toContain("2. AI: LLM:");
      expect(prompt).toContain("3. Web: Frontend:");
    });

    it("should include category selection requirements", () => {
      const customConfig = {
        ...mockConfig,
        minCategoriesPerRepo: 2,
        maxCategoriesPerRepo: 4,
      };

      const prompt = buildClassifierPrompt(mockRepoDetail, mockCategories, customConfig);

      expect(prompt).toContain("2-4");
    });

    it("should include category count", () => {
      const prompt = buildClassifierPrompt(mockRepoDetail, mockCategories, mockConfig);

      expect(prompt).toContain(`Available Categories (${mockCategories.length})`);
    });

    it("should not add ellipsis for short README", () => {
      const repo: RepoDetail = {
        ...mockRepoDetail,
        readme: "Short README",
      };

      const prompt = buildClassifierPrompt(repo, mockCategories, mockConfig);

      expect(prompt).toContain("Short README");
      // Check that there's no unexpected ellipsis
      const readmeSection = prompt.split("## README")[1]?.split("##")[0];
      if (readmeSection) {
        expect(readmeSection.trim().endsWith("...")).toBe(false);
      }
    });
  });
});
