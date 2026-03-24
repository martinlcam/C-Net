// Drizzle Kit loads this file as CommonJS; ESM .ts config fails with "require is not defined" on Windows.
const { existsSync } = require("node:fs")
const { resolve } = require("node:path")
const { config } = require("dotenv")
const { defineConfig } = require("drizzle-kit")

const repoRoot = resolve(__dirname, "../..")
for (const file of [".env", ".env.local"]) {
  const envPath = resolve(repoRoot, file)
  if (existsSync(envPath)) {
    config({ path: envPath, override: file === ".env.local" })
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Set it in .env at the repo root or export DATABASE_URL."
  )
}

module.exports = defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
})
