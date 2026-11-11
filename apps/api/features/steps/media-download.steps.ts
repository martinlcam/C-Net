import assert from "node:assert/strict"
import { type Disposition, vaultSigningSecret, verifyDownload } from "@cnet/core"
import { Given, Then, When } from "@cucumber/cucumber"
import { downloadFilename, signMediaDownloadUrl } from "../../src/media/urls"
import type { InviteWorld } from "../support/world"

const ITEM_ID = "bdd-download-1"

Given(
  "a Jellyfin episode {string} of {string}, season {int} episode {int}, stored as {string}",
  function (
    this: InviteWorld,
    title: string,
    series: string,
    season: number,
    episode: number,
    file: string
  ) {
    this.jellyfinItem = {
      Id: ITEM_ID,
      Name: title,
      Type: "Episode",
      SeriesName: series,
      ParentIndexNumber: season,
      IndexNumber: episode,
      Path: `/mnt/media/TV/${file}`,
    }
  }
)

Given(
  "a Jellyfin movie {string} from {int}, stored as {string}",
  function (this: InviteWorld, title: string, year: number, file: string) {
    this.jellyfinItem = {
      Id: ITEM_ID,
      Name: title,
      Type: "Movie",
      ProductionYear: year,
      Path: `/mnt/media/Movies/${file}`,
    }
  }
)

Given(
  "a Jellyfin movie {string} from {int} in a {string} container with no path",
  function (this: InviteWorld, title: string, year: number, container: string) {
    this.jellyfinItem = {
      Id: ITEM_ID,
      Name: title,
      Type: "Movie",
      ProductionYear: year,
      MediaSources: [{ Id: ITEM_ID, Container: container }],
    }
  }
)

When("I name its download", function (this: InviteWorld) {
  if (!this.jellyfinItem) throw new Error("no Jellyfin item in this scenario")
  this.downloadName = downloadFilename(this.jellyfinItem)
})

When("I sign its download link for user {string}", function (this: InviteWorld, userId: string) {
  if (!this.jellyfinItem) throw new Error("no Jellyfin item in this scenario")
  this.downloadName = downloadFilename(this.jellyfinItem)
  this.downloadUrl = signMediaDownloadUrl(userId, this.jellyfinItem.Id, this.downloadName)
})

Then("the download is named {string}", function (this: InviteWorld, expected: string) {
  assert.equal(this.downloadName, expected)
})

function linkParts(world: InviteWorld) {
  if (!world.downloadUrl) throw new Error("no download link in this scenario")
  const url = new URL(world.downloadUrl, "http://bdd.local")
  return {
    path: url.pathname,
    name: url.searchParams.get("name"),
    exp: Number(url.searchParams.get("exp")),
    sig: url.searchParams.get("sig") ?? "",
  }
}

function verifies(world: InviteWorld, userId: string, disposition: Disposition): boolean {
  const { exp, sig } = linkParts(world)
  return verifyDownload(
    { userId, fileId: ITEM_ID, exp, disposition, sig },
    vaultSigningSecret(),
    Date.now()
  ).ok
}

Then("the link carries the filename {string}", function (this: InviteWorld, expected: string) {
  const { path, name } = linkParts(this)
  assert.equal(name, expected)
  assert.equal(path, `/media/download/bdd-user/${ITEM_ID}`)
})

Then(
  "the link verifies as an attachment for user {string}",
  function (this: InviteWorld, userId: string) {
    assert.equal(verifies(this, userId, "attachment"), true)
  }
)

Then(
  "the link does not verify as an inline stream for user {string}",
  function (this: InviteWorld, userId: string) {
    assert.equal(verifies(this, userId, "inline"), false)
  }
)

Then(
  "the link does not verify as an attachment for user {string}",
  function (this: InviteWorld, userId: string) {
    assert.equal(verifies(this, userId, "attachment"), false)
  }
)
