import react from "@vitejs/plugin-react"
import nextEnv from "@next/env"
import { defineConfig } from "vitest/config"

// Reads .env / .env.local so TEST_DATABASE_URL can be overridden per machine.
nextEnv.loadEnvConfig(process.cwd(), true)

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    clearMocks: true,
    environment: "jsdom",
    exclude: [".next", "node_modules"],
    restoreMocks: true,
    globalSetup: ["./server/test/global-setup.ts"],
    // DB suites share one database: run files one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
})
