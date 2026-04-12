import { defineConfig } from "orval"

export default defineConfig({
  cnet: {
    input: {
      target: "../../apps/api/src/generated/swagger.json",
    },
    output: {
      target: "./src/generated/api.ts",
      client: "fetch",
      mode: "single",
      baseUrl: "http://localhost:4000",
    },
  },
})
