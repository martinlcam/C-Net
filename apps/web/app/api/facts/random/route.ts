import { NextResponse } from "next/server"

/*
 * One random fact for the masthead's ticker, from uselessfacts.jsph.pl:
 * free, keyless and English. Never cached, so every click is a new one.
 */

export type Fact = {
  text: string
  source: string
}

export async function GET() {
  try {
    const res = await fetch("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    if (!res.ok) throw new Error(`uselessfacts responded ${res.status}`)
    const fact = (await res.json()) as { text?: string; source?: string }
    if (!fact.text) throw new Error("uselessfacts returned no text")

    const body: Fact = { text: fact.text.trim(), source: fact.source ?? "" }
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[facts/random]", error)
    return NextResponse.json({ error: "No facts right now" }, { status: 502 })
  }
}
