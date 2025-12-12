import { describe, it, expect } from "bun:test";
import {
  RateLimiter,
  delay,
  retryWithBackoff,
  runWithConcurrency,
  processBatch,
} from "../../src/utils/rate-limiter";

describe("rate-limiter", () => {
  describe("delay", () => {
    it("should delay for specified milliseconds", async () => {
      const start = Date.now();
      await delay(50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe("RateLimiter", () => {
    it("should throttle function calls", async () => {
      const limiter = new RateLimiter(50);
      const results: number[] = [];

      const start = Date.now();
      await limiter.throttle(async () => results.push(1));
      await limiter.throttle(async () => results.push(2));
      const elapsed = Date.now() - start;

      expect(results).toEqual([1, 2]);
      expect(elapsed).toBeGreaterThanOrEqual(45);
    });

    it("should not throttle if enough time has passed", async () => {
      const limiter = new RateLimiter(20);

      await limiter.throttle(async () => 1);
      await delay(30);

      const start = Date.now();
      await limiter.throttle(async () => 2);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(15);
    });
  });

  describe("retryWithBackoff", () => {
    it("should return result on first success", async () => {
      let attempts = 0;
      const result = await retryWithBackoff(async () => {
        attempts++;
        return "success";
      });

      expect(result).toBe("success");
      expect(attempts).toBe(1);
    });

    it("should retry on failure and succeed eventually", async () => {
      let attempts = 0;
      const result = await retryWithBackoff(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error("Temporary failure");
          }
          return "success";
        },
        { maxRetries: 3, initialDelayMs: 10, maxDelayMs: 50 }
      );

      expect(result).toBe("success");
      expect(attempts).toBe(3);
    });

    it("should throw after max retries exceeded", async () => {
      let attempts = 0;

      await expect(
        retryWithBackoff(
          async () => {
            attempts++;
            throw new Error("Persistent failure");
          },
          { maxRetries: 2, initialDelayMs: 10 }
        )
      ).rejects.toThrow("Persistent failure");

      expect(attempts).toBe(3); // Initial + 2 retries
    });

    it("should use exponential backoff", async () => {
      let attempts = 0;
      const timestamps: number[] = [];

      try {
        await retryWithBackoff(
          async () => {
            timestamps.push(Date.now());
            attempts++;
            throw new Error("Failure");
          },
          { maxRetries: 2, initialDelayMs: 20, maxDelayMs: 100 }
        );
      } catch {
        // Expected to throw
      }

      expect(timestamps.length).toBe(3);
      // Second delay should be longer than first
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];
      expect(delay2).toBeGreaterThanOrEqual(delay1);
    });
  });

  describe("runWithConcurrency", () => {
    it("should process all items", async () => {
      const items = [1, 2, 3, 4, 5];
      const results = await runWithConcurrency(
        items,
        async (item) => item * 2,
        2
      );

      expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    it("should respect concurrency limit", async () => {
      let concurrent = 0;
      let maxConcurrent = 0;
      const items = [1, 2, 3, 4, 5, 6];

      await runWithConcurrency(
        items,
        async (item) => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await delay(20);
          concurrent--;
          return item;
        },
        3
      );

      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });

    it("should handle empty array", async () => {
      const results = await runWithConcurrency(
        [],
        async (item: number) => item * 2,
        5
      );

      expect(results).toEqual([]);
    });

    it("should maintain order of results", async () => {
      const items = [5, 1, 3, 2, 4];
      const results = await runWithConcurrency(
        items,
        async (item) => {
          await delay(item * 5);
          return item;
        },
        5
      );

      expect(results).toEqual([5, 1, 3, 2, 4]);
    });
  });

  describe("processBatch", () => {
    it("should process items in batches", async () => {
      const items = [1, 2, 3, 4, 5];
      const results = await processBatch(
        items,
        async (item) => item * 2,
        { batchSize: 2, batchDelayMs: 10 }
      );

      expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    it("should call onProgress callback", async () => {
      const items = [1, 2, 3, 4, 5];
      const progressCalls: Array<{ completed: number; total: number }> = [];

      await processBatch(
        items,
        async (item) => item,
        {
          batchSize: 2,
          batchDelayMs: 10,
          onProgress: (completed, total) => {
            progressCalls.push({ completed, total });
          },
        }
      );

      expect(progressCalls).toEqual([
        { completed: 2, total: 5 },
        { completed: 4, total: 5 },
        { completed: 5, total: 5 },
      ]);
    });

    it("should handle batch size larger than items", async () => {
      const items = [1, 2, 3];
      const results = await processBatch(
        items,
        async (item) => item * 2,
        { batchSize: 10 }
      );

      expect(results).toEqual([2, 4, 6]);
    });

    it("should delay between batches but not after last batch", async () => {
      const items = [1, 2, 3, 4];
      const start = Date.now();

      await processBatch(
        items,
        async (item) => item,
        { batchSize: 2, batchDelayMs: 50 }
      );

      const elapsed = Date.now() - start;
      // Should have exactly one delay (between batch 1 and 2)
      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(elapsed).toBeLessThan(120); // Not two delays
    });

    it("should pass correct index to processor", async () => {
      const items = ["a", "b", "c"];
      const indices: number[] = [];

      await processBatch(
        items,
        async (_, index) => {
          indices.push(index);
          return index;
        },
        { batchSize: 2 }
      );

      expect(indices).toEqual([0, 1, 2]);
    });
  });
});
