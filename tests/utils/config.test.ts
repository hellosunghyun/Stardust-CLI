import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { loadConfig, getConfig, resetConfig } from "../../src/utils/config";

describe("config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetConfig();
    // Clear all relevant environment variables
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_USERNAME;
    delete process.env.GEMINI_API_KEY;
    delete process.env.MAX_CATEGORIES;
    delete process.env.MAX_CATEGORIES_PER_REPO;
    delete process.env.MIN_CATEGORIES_PER_REPO;
    delete process.env.CLASSIFY_BATCH_SIZE;
    delete process.env.README_BATCH_SIZE;
    delete process.env.LIST_CREATE_DELAY;
    delete process.env.BATCH_DELAY;
    delete process.env.GEMINI_RPM;
    delete process.env.GITHUB_REQUEST_DELAY;
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_TEMPERATURE_PLANNING;
    delete process.env.GEMINI_TEMPERATURE_CLASSIFY;
    delete process.env.GEMINI_MAX_TOKENS_PLANNING;
    delete process.env.GEMINI_MAX_TOKENS_CLASSIFY;
    delete process.env.README_MAX_LENGTH;
    delete process.env.README_MAX_LENGTH_SINGLE;
    delete process.env.LIST_IS_PRIVATE;
    delete process.env.LIST_NAME_MAX_LENGTH;
    delete process.env.MAX_RETRIES;
    delete process.env.RETRY_DELAY;
    delete process.env.DEBUG;
    delete process.env.LOG_API_RESPONSES;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetConfig();
  });

  describe("loadConfig", () => {
    it("should throw error when GITHUB_TOKEN is missing", () => {
      process.env.GITHUB_USERNAME = "testuser";
      process.env.GEMINI_API_KEY = "test-api-key";

      expect(() => loadConfig()).toThrow("GITHUB_TOKEN environment variable is required");
    });

    it("should throw error when GITHUB_USERNAME is missing", () => {
      process.env.GITHUB_TOKEN = "test-token";
      process.env.GEMINI_API_KEY = "test-api-key";

      expect(() => loadConfig()).toThrow("GITHUB_USERNAME environment variable is required");
    });

    it("should throw error when GEMINI_API_KEY is missing", () => {
      process.env.GITHUB_TOKEN = "test-token";
      process.env.GITHUB_USERNAME = "testuser";

      expect(() => loadConfig()).toThrow("GEMINI_API_KEY environment variable is required");
    });

    it("should load config with default values", () => {
      process.env.GITHUB_TOKEN = "test-token";
      process.env.GITHUB_USERNAME = "testuser";
      process.env.GEMINI_API_KEY = "test-api-key";

      const config = loadConfig();

      expect(config.githubToken).toBe("test-token");
      expect(config.githubUsername).toBe("testuser");
      expect(config.geminiApiKey).toBe("test-api-key");
      expect(config.maxCategories).toBe(32);
      expect(config.maxCategoriesPerRepo).toBe(3);
      expect(config.minCategoriesPerRepo).toBe(1);
      expect(config.classifyBatchSize).toBe(20);
      expect(config.readmeBatchSize).toBe(20);
      expect(config.listCreateDelay).toBe(500);
      expect(config.batchDelay).toBe(2000);
      expect(config.geminiRpm).toBe(15);
      expect(config.githubRequestDelay).toBe(100);
      expect(config.geminiModel).toBe("gemini-2.5-flash");
      expect(config.geminiTemperaturePlanning).toBe(0.7);
      expect(config.geminiTemperatureClassify).toBe(0.3);
      expect(config.geminiMaxTokensPlanning).toBe(65536);
      expect(config.geminiMaxTokensClassify).toBe(65536);
      expect(config.readmeMaxLength).toBe(10000);
      expect(config.readmeMaxLengthSingle).toBe(10000);
      expect(config.listIsPrivate).toBe(false);
      expect(config.listNameMaxLength).toBe(20);
      expect(config.maxRetries).toBe(3);
      expect(config.retryDelay).toBe(1000);
      expect(config.debug).toBe(false);
      expect(config.logApiResponses).toBe(false);
    });

    it("should override defaults with environment variables", () => {
      process.env.GITHUB_TOKEN = "test-token";
      process.env.GITHUB_USERNAME = "testuser";
      process.env.GEMINI_API_KEY = "test-api-key";
      process.env.MAX_CATEGORIES = "16";
      process.env.MAX_CATEGORIES_PER_REPO = "5";
      process.env.LIST_IS_PRIVATE = "true";
      process.env.DEBUG = "true";
      process.env.GEMINI_MODEL = "gemini-pro";

      const config = loadConfig();

      expect(config.maxCategories).toBe(16);
      expect(config.maxCategoriesPerRepo).toBe(5);
      expect(config.listIsPrivate).toBe(true);
      expect(config.debug).toBe(true);
      expect(config.geminiModel).toBe("gemini-pro");
    });

    it("should handle invalid integer values gracefully", () => {
      process.env.GITHUB_TOKEN = "test-token";
      process.env.GITHUB_USERNAME = "testuser";
      process.env.GEMINI_API_KEY = "test-api-key";
      process.env.MAX_CATEGORIES = "invalid";

      const config = loadConfig();

      expect(config.maxCategories).toBe(32); // Should use default
    });

    it("should handle invalid float values gracefully", () => {
      process.env.GITHUB_TOKEN = "test-token";
      process.env.GITHUB_USERNAME = "testuser";
      process.env.GEMINI_API_KEY = "test-api-key";
      process.env.GEMINI_TEMPERATURE_PLANNING = "invalid";

      const config = loadConfig();

      expect(config.geminiTemperaturePlanning).toBe(0.7); // Should use default
    });

    it("should parse boolean values correctly", () => {
      process.env.GITHUB_TOKEN = "test-token";
      process.env.GITHUB_USERNAME = "testuser";
      process.env.GEMINI_API_KEY = "test-api-key";
      process.env.LIST_IS_PRIVATE = "1";

      const config = loadConfig();

      expect(config.listIsPrivate).toBe(true);
    });
  });

  describe("getConfig", () => {
    it("should return singleton instance", () => {
      process.env.GITHUB_TOKEN = "test-token";
      process.env.GITHUB_USERNAME = "testuser";
      process.env.GEMINI_API_KEY = "test-api-key";

      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1).toBe(config2);
    });
  });

  describe("resetConfig", () => {
    it("should clear singleton instance", () => {
      process.env.GITHUB_TOKEN = "test-token";
      process.env.GITHUB_USERNAME = "testuser";
      process.env.GEMINI_API_KEY = "test-api-key";

      const config1 = getConfig();
      resetConfig();

      // Change env and get new config
      process.env.GITHUB_TOKEN = "new-token";
      const config2 = getConfig();

      expect(config1.githubToken).toBe("test-token");
      expect(config2.githubToken).toBe("new-token");
    });
  });
});
