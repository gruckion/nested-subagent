import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.integration.test.ts"],
    // Integration tests spawn claude processes - need longer timeouts
    testTimeout: 120000, // 2 minutes per test
    hookTimeout: 30000,
    // Run serially to avoid concurrent claude processes
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
