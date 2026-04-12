import { resolve } from "node:path"
import dotenv from "dotenv"

dotenv.config({ path: resolve(process.cwd(), "../../.env") })

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}
