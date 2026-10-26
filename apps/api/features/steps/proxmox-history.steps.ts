import assert from "node:assert/strict"
import { HOST_HISTORY_KEY } from "@cnet/engine"
import { Given, Then, When } from "@cucumber/cucumber"
import { getRedis } from "../../src/lib/redis-client"
import type { InviteWorld } from "../support/world"

const redis = getRedis()

Given("the host agent has published frames at {int} and {int}", async (a: number, b: number) => {
  await redis.del(HOST_HISTORY_KEY)
  // Newest first, as the agent LPUSHes.
  for (const ts of [a, b]) {
    await redis.lpush(
      HOST_HISTORY_KEY,
      JSON.stringify({
        t: "host",
        ts,
        node: { cpu: 0, mem: 0, maxmem: 0, uptimeSeconds: 0 },
        guests: [],
        ups: null,
      })
    )
  }
})

When("I request the host history", async function (this: InviteWorld) {
  await this.get("/proxmox/overview/history")
})

Then(
  "the history holds {int} frames ending at {int}",
  function (this: InviteWorld, n: number, last: number) {
    const frames = this.res.body as { ts: number }[]
    assert.equal(frames.length, n, JSON.stringify(this.res.body))
    assert.equal(frames[frames.length - 1].ts, last)
    assert.ok(
      frames.every((f, i) => i === 0 || f.ts >= frames[i - 1].ts),
      "ascending by ts"
    )
  }
)
