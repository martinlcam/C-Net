import assert from "node:assert/strict"
import { Given, Then, When } from "@cucumber/cucumber"
import type { InviteWorld } from "../support/world"

Given("the Proxmox connection is not configured", () => {
  for (const k of ["CNET_STORAGE_PVE_HOST", "CNET_STORAGE_PVE_USER", "CNET_STORAGE_PVE_TOKEN"]) {
    delete process.env[k]
  }
})

When("I request the Proxmox overview", async function (this: InviteWorld) {
  await this.get("/proxmox/overview")
})

Then("the error message mentions {string}", function (this: InviteWorld, needle: string) {
  const body = this.res.body as { message?: string; error?: string }
  const text = `${body.error ?? ""} ${body.message ?? ""}`
  assert.ok(text.includes(needle), `expected "${needle}" in: ${text}`)
})
