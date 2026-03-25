import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { config } from "dotenv"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, "../../..")
for (const file of [".env", ".env.local"] as const) {
  const path = resolve(repoRoot, file)
  if (existsSync(path)) config({ path, override: file === ".env.local" })
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set")
  process.exit(1)
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

const db = drizzle(pool)

console.log("Running migrations...")
await migrate(db, { migrationsFolder: resolve(__dirname, "../migrations") })
console.log("Migrations complete.")

await pool.end()
