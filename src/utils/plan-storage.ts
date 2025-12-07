import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import type { Category } from "../types";

const PLAN_FILE = ".startidy-plan.json";

export interface StoredPlan {
  createdAt: string;
  repoCount: number;
  categories: Category[];
}

export function savePlan(categories: Category[], repoCount: number): void {
  const plan: StoredPlan = {
    createdAt: new Date().toISOString(),
    repoCount,
    categories,
  };
  writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2), "utf-8");
}

export function loadPlan(): StoredPlan | null {
  if (!existsSync(PLAN_FILE)) {
    return null;
  }
  try {
    const content = readFileSync(PLAN_FILE, "utf-8");
    return JSON.parse(content) as StoredPlan;
  } catch {
    return null;
  }
}

export function deletePlan(): boolean {
  if (existsSync(PLAN_FILE)) {
    unlinkSync(PLAN_FILE);
    return true;
  }
  return false;
}

export function planExists(): boolean {
  return existsSync(PLAN_FILE);
}
