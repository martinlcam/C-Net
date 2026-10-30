import assert from "node:assert/strict"
import type { JellyfinItem, JellyfinTrickplayInfo } from "@cnet/engine"
import { Given, Then, When } from "@cucumber/cucumber"
import { buildItemTracks } from "../../src/controllers/media.controller"
import type { InviteWorld } from "../support/world"

const ITEM_ID = "bdd-item-1"

function grid(width: number, tile = 10, intervalMs = 10_000): JellyfinTrickplayInfo {
  return {
    Width: width,
    Height: Math.round((width * 9) / 16),
    TileWidth: tile,
    TileHeight: tile,
    ThumbnailCount: 144,
    Interval: intervalMs,
  }
}

function item(trickplay?: JellyfinItem["Trickplay"]): JellyfinItem {
  return { Id: ITEM_ID, Name: "BDD Episode", MediaStreams: [], Trickplay: trickplay }
}

Given(
  "a Jellyfin item with trickplay tiles {int} pixels wide, {int} by {int} per sheet, every {int} milliseconds",
  function (this: InviteWorld, width: number, cols: number, rows: number, intervalMs: number) {
    const g = grid(width, cols, intervalMs)
    g.TileHeight = rows
    this.jellyfinItem = item({ [ITEM_ID]: { [String(width)]: g } })
  }
)

Given(
  "a Jellyfin item with trickplay tiles at widths {int} and {int}",
  function (this: InviteWorld, a: number, b: number) {
    this.jellyfinItem = item({ [ITEM_ID]: { [String(a)]: grid(a), [String(b)]: grid(b) } })
  }
)

Given("a Jellyfin item with no trickplay tiles", function (this: InviteWorld) {
  this.jellyfinItem = item()
})

When("I build its track listing", function (this: InviteWorld) {
  if (!this.jellyfinItem) throw new Error("no Jellyfin item in this scenario")
  this.tracks = buildItemTracks("bdd-user", this.jellyfinItem)
})

Then(
  "the listing has a trickplay grid {int} wide with {int} by {int} tiles every {int} seconds",
  function (this: InviteWorld, width: number, cols: number, rows: number, seconds: number) {
    const t = this.tracks?.trickplay
    assert.ok(t, "expected a trickplay grid")
    assert.equal(t.width, width)
    assert.equal(t.tileWidth, cols)
    assert.equal(t.tileHeight, rows)
    assert.equal(t.intervalSeconds, seconds)
  }
)

Then("the listing has a trickplay grid {int} wide", function (this: InviteWorld, width: number) {
  assert.equal(this.tracks?.trickplay?.width, width)
})

Then("the listing has no trickplay grid", function (this: InviteWorld) {
  assert.equal(this.tracks?.trickplay, null)
})
