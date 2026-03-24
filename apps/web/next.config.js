import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { config as loadEnv } from "dotenv"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, "..", "..")
// Next.js only auto-loads `.env*` from `apps/web/`. Monorepo secrets usually live at repo root.
loadEnv({ path: join(repoRoot, ".env") })
loadEnv({ path: join(repoRoot, ".env.local"), override: true })

/* @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  transpilePackages: ["@cnet/db", "@cnet/api-client", "@cnet/core", "@cnet/engine"],
}

export default nextConfig
