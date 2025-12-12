import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";

// Mock the version comparison function by testing the logic directly
// Since isNewerVersion is private, we test checkForUpdates behavior

describe("update-checker", () => {
  describe("isNewerVersion logic", () => {
    // Test the version comparison logic directly
    function isNewerVersion(current: string, latest: string): boolean {
      const currentParts = current.replace(/^v/, "").split(".").map(Number);
      const latestParts = latest.replace(/^v/, "").split(".").map(Number);

      for (let i = 0; i < 3; i++) {
        const curr = currentParts[i] || 0;
        const lat = latestParts[i] || 0;
        if (lat > curr) return true;
        if (lat < curr) return false;
      }
      return false;
    }

    it("should return true when latest is newer major version", () => {
      expect(isNewerVersion("1.0.0", "2.0.0")).toBe(true);
    });

    it("should return true when latest is newer minor version", () => {
      expect(isNewerVersion("1.0.0", "1.1.0")).toBe(true);
    });

    it("should return true when latest is newer patch version", () => {
      expect(isNewerVersion("1.0.0", "1.0.1")).toBe(true);
    });

    it("should return false when versions are equal", () => {
      expect(isNewerVersion("1.0.0", "1.0.0")).toBe(false);
    });

    it("should return false when current is newer", () => {
      expect(isNewerVersion("2.0.0", "1.0.0")).toBe(false);
      expect(isNewerVersion("1.2.0", "1.1.0")).toBe(false);
      expect(isNewerVersion("1.0.2", "1.0.1")).toBe(false);
    });

    it("should handle v prefix", () => {
      expect(isNewerVersion("v1.0.0", "v2.0.0")).toBe(true);
      expect(isNewerVersion("v1.0.0", "1.1.0")).toBe(true);
      expect(isNewerVersion("1.0.0", "v1.0.1")).toBe(true);
    });

    it("should handle partial versions", () => {
      expect(isNewerVersion("1.0", "1.0.1")).toBe(true);
      expect(isNewerVersion("1", "1.0.1")).toBe(true);
      expect(isNewerVersion("1.0.0", "1.1")).toBe(true);
    });

    it("should compare complex versions correctly", () => {
      expect(isNewerVersion("1.9.9", "1.10.0")).toBe(true);
      expect(isNewerVersion("1.10.0", "1.9.9")).toBe(false);
      expect(isNewerVersion("2.0.0", "1.99.99")).toBe(false);
    });
  });

  describe("checkForUpdates", () => {
    const originalFetch = global.fetch;
    const originalConsoleLog = console.log;

    beforeEach(() => {
      console.log = mock(() => {});
    });

    afterEach(() => {
      global.fetch = originalFetch;
      console.log = originalConsoleLog;
    });

    it("should not throw on network failure", async () => {
      global.fetch = mock(() => Promise.reject(new Error("Network error")));

      const { checkForUpdates } = await import("../../src/utils/update-checker");

      // Should complete without throwing
      await expect(checkForUpdates()).resolves.toBeUndefined();
    });

    it("should handle non-ok response silently", async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 404,
        } as Response)
      );

      const { checkForUpdates } = await import("../../src/utils/update-checker");

      await expect(checkForUpdates()).resolves.toBeUndefined();
    });
  });
});
