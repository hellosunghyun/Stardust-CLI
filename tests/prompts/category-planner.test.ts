import { describe, it, expect } from "bun:test";
import { buildCategoryPlannerPrompt } from "../../src/prompts/category-planner";
import type { RepoSummary } from "../../src/types";
import type { Config } from "../../src/utils/config";

describe("prompts/category-planner", () => {
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
    readmeMaxLength: 10000,
    readmeMaxLengthSingle: 10000,
    listIsPrivate: false,
    listNameMaxLength: 20,
    maxRetries: 3,
    retryDelay: 1000,
    debug: false,
    logApiResponses: false,
  };

  describe("buildCategoryPlannerPrompt", () => {
    it("should include repository information", () => {
      const repos: RepoSummary[] = [
        {
          owner: "facebook",
          name: "react",
          description: "A JavaScript library for building user interfaces",
          language: "JavaScript",
          stars: 200000,
        },
        {
          owner: "microsoft",
          name: "typescript",
          description: "TypeScript is a superset of JavaScript",
          language: "TypeScript",
          stars: 90000,
        },
      ];

      const prompt = buildCategoryPlannerPrompt(repos, mockConfig);

      expect(prompt).toContain("facebook/react");
      expect(prompt).toContain("microsoft/typescript");
      expect(prompt).toContain("JavaScript library for building user interfaces");
      expect(prompt).toContain("[JavaScript]");
      expect(prompt).toContain("[TypeScript]");
      expect(prompt).toContain("200000 stars");
      expect(prompt).toContain("90000 stars");
    });

    it("should handle repos without description", () => {
      const repos: RepoSummary[] = [
        {
          owner: "user",
          name: "repo",
          description: null,
          language: "Python",
          stars: 100,
        },
      ];

      const prompt = buildCategoryPlannerPrompt(repos, mockConfig);

      expect(prompt).toContain("No description");
    });

    it("should handle repos without language", () => {
      const repos: RepoSummary[] = [
        {
          owner: "user",
          name: "repo",
          description: "Test repo",
          language: null,
          stars: 100,
        },
      ];

      const prompt = buildCategoryPlannerPrompt(repos, mockConfig);

      expect(prompt).toContain("[Unknown]");
    });

    it("should include repo count", () => {
      const repos: RepoSummary[] = [
        { owner: "a", name: "1", description: "d1", language: "Go", stars: 1 },
        { owner: "b", name: "2", description: "d2", language: "Go", stars: 2 },
        { owner: "c", name: "3", description: "d3", language: "Go", stars: 3 },
      ];

      const prompt = buildCategoryPlannerPrompt(repos, mockConfig);

      expect(prompt).toContain("3 starred repositories");
    });

    it("should include max categories from config", () => {
      const repos: RepoSummary[] = [
        { owner: "user", name: "repo", description: "Test", language: "Go", stars: 100 },
      ];

      const customConfig = { ...mockConfig, maxCategories: 16 };
      const prompt = buildCategoryPlannerPrompt(repos, customConfig);

      expect(prompt).toContain("exactly 16 categories");
    });

    it("should include list name max length", () => {
      const repos: RepoSummary[] = [
        { owner: "user", name: "repo", description: "Test", language: "Go", stars: 100 },
      ];

      const customConfig = { ...mockConfig, listNameMaxLength: 25 };
      const prompt = buildCategoryPlannerPrompt(repos, customConfig);

      expect(prompt).toContain("Maximum 25 characters");
    });

    it("should include category naming rules", () => {
      const repos: RepoSummary[] = [
        { owner: "user", name: "repo", description: "Test", language: "Go", stars: 100 },
      ];

      const prompt = buildCategoryPlannerPrompt(repos, mockConfig);

      expect(prompt).toContain("Major: Minor");
      expect(prompt).toContain("Lang: Python");
      expect(prompt).toContain("AI: LLM");
      expect(prompt).toContain("ETC category");
    });

    it("should include major category examples", () => {
      const repos: RepoSummary[] = [
        { owner: "user", name: "repo", description: "Test", language: "Go", stars: 100 },
      ];

      const prompt = buildCategoryPlannerPrompt(repos, mockConfig);

      expect(prompt).toContain("Lang:");
      expect(prompt).toContain("AI:");
      expect(prompt).toContain("Web:");
      expect(prompt).toContain("Infra:");
      expect(prompt).toContain("Type:");
    });

    it("should format repository list correctly", () => {
      const repos: RepoSummary[] = [
        {
          owner: "owner1",
          name: "repo1",
          description: "Description 1",
          language: "Rust",
          stars: 5000,
        },
      ];

      const prompt = buildCategoryPlannerPrompt(repos, mockConfig);

      expect(prompt).toContain("- owner1/repo1: Description 1 [Rust] (5000 stars)");
    });

    it("should handle empty repos array", () => {
      const repos: RepoSummary[] = [];

      const prompt = buildCategoryPlannerPrompt(repos, mockConfig);

      expect(prompt).toContain("0 starred repositories");
    });

    it("should include requirements section", () => {
      const repos: RepoSummary[] = [
        { owner: "user", name: "repo", description: "Test", language: "Go", stars: 100 },
      ];

      const prompt = buildCategoryPlannerPrompt(repos, mockConfig);

      expect(prompt).toContain("## Requirements:");
      expect(prompt).toContain("## Category Naming Rules");
      expect(prompt).toContain("## Major Category Examples:");
      expect(prompt).toContain("## Category Planning Principles:");
    });
  });
});
