import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, unlinkSync } from "fs";
import {
  savePlan,
  loadPlan,
  deletePlan,
  planExists,
} from "../../src/utils/plan-storage";
import type { Category } from "../../src/types";

const PLAN_FILE = ".startidy-plan.json";

describe("plan-storage", () => {
  beforeEach(() => {
    // Clean up any existing plan file before each test
    if (existsSync(PLAN_FILE)) {
      unlinkSync(PLAN_FILE);
    }
  });

  afterEach(() => {
    // Clean up after each test
    if (existsSync(PLAN_FILE)) {
      unlinkSync(PLAN_FILE);
    }
  });

  describe("savePlan", () => {
    it("should save plan to file", () => {
      const categories: Category[] = [
        { name: "Lang: Python", description: "Python projects", keywords: [] },
        { name: "AI: LLM", description: "LLM projects", keywords: [] },
      ];

      savePlan(categories, 100);

      expect(existsSync(PLAN_FILE)).toBe(true);
    });

    it("should save correct data structure", () => {
      const categories: Category[] = [
        { name: "Test Category", description: "Test description", keywords: ["test"] },
      ];

      savePlan(categories, 50);

      const plan = loadPlan();
      expect(plan).not.toBeNull();
      expect(plan!.categories).toEqual(categories);
      expect(plan!.repoCount).toBe(50);
      expect(plan!.createdAt).toBeDefined();
    });

    it("should overwrite existing plan", () => {
      const categories1: Category[] = [
        { name: "First", description: "First category", keywords: [] },
      ];
      const categories2: Category[] = [
        { name: "Second", description: "Second category", keywords: [] },
      ];

      savePlan(categories1, 10);
      savePlan(categories2, 20);

      const plan = loadPlan();
      expect(plan!.categories[0].name).toBe("Second");
      expect(plan!.repoCount).toBe(20);
    });
  });

  describe("loadPlan", () => {
    it("should return null when no plan exists", () => {
      const plan = loadPlan();
      expect(plan).toBeNull();
    });

    it("should load saved plan correctly", () => {
      const categories: Category[] = [
        { name: "Category1", description: "Desc1", keywords: ["k1"] },
        { name: "Category2", description: "Desc2", keywords: ["k2"] },
      ];

      savePlan(categories, 75);

      const plan = loadPlan();
      expect(plan).not.toBeNull();
      expect(plan!.categories.length).toBe(2);
      expect(plan!.repoCount).toBe(75);
      expect(new Date(plan!.createdAt).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it("should return null for invalid JSON", async () => {
      // Write invalid JSON to the file
      await Bun.write(PLAN_FILE, "{ invalid json }");

      const plan = loadPlan();
      expect(plan).toBeNull();
    });
  });

  describe("deletePlan", () => {
    it("should delete existing plan and return true", () => {
      savePlan([{ name: "Test", description: "Test", keywords: [] }], 10);
      expect(existsSync(PLAN_FILE)).toBe(true);

      const result = deletePlan();

      expect(result).toBe(true);
      expect(existsSync(PLAN_FILE)).toBe(false);
    });

    it("should return false when no plan exists", () => {
      const result = deletePlan();
      expect(result).toBe(false);
    });
  });

  describe("planExists", () => {
    it("should return false when no plan exists", () => {
      expect(planExists()).toBe(false);
    });

    it("should return true when plan exists", () => {
      savePlan([{ name: "Test", description: "Test", keywords: [] }], 10);
      expect(planExists()).toBe(true);
    });
  });

  describe("integration", () => {
    it("should handle full workflow: save, load, delete", () => {
      const categories: Category[] = [
        { name: "Lang: Go", description: "Go projects", keywords: ["golang"] },
        { name: "Web: Frontend", description: "Frontend", keywords: ["react", "vue"] },
      ];

      // Initially no plan
      expect(planExists()).toBe(false);
      expect(loadPlan()).toBeNull();

      // Save plan
      savePlan(categories, 200);
      expect(planExists()).toBe(true);

      // Load and verify
      const loaded = loadPlan();
      expect(loaded!.categories.length).toBe(2);
      expect(loaded!.repoCount).toBe(200);

      // Delete
      expect(deletePlan()).toBe(true);
      expect(planExists()).toBe(false);
      expect(loadPlan()).toBeNull();

      // Delete again should return false
      expect(deletePlan()).toBe(false);
    });
  });
});
