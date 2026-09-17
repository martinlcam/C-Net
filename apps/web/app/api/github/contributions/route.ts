import { NextResponse } from "next/server"

/*
 * The past year of GitHub contributions, one entry per day, oldest first.
 * With a GITHUB_TOKEN in the environment the GraphQL API is asked; without
 * one the public contributions page is read instead, so the graph works on a
 * bare checkout too. The upstream answer is cached for 15 minutes.
 */

const LOGIN = "martinlcam"
const REVALIDATE = 15 * 60

export type ContributionLevel = 0 | 1 | 2 | 3 | 4

export type ContributionDay = {
  date: string
  count: number
  level: ContributionLevel
}

export type Contributions = {
  login: string
  total: number
  days: ContributionDay[]
  fetchedAt: string
}

const GRAPHQL_LEVELS: Record<string, ContributionLevel> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
}

type CalendarResponse = {
  data?: {
    user?: {
      contributionsCollection: {
        contributionCalendar: {
          weeks: {
            contributionDays: {
              date: string
              contributionCount: number
              contributionLevel: string
            }[]
          }[]
        }
      }
    }
  }
}

async function fromGraphql(token: string): Promise<ContributionDay[]> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query($login: String!) {
        user(login: $login) {
          contributionsCollection {
            contributionCalendar {
              weeks { contributionDays { date contributionCount contributionLevel } }
            }
          }
        }
      }`,
      variables: { login: LOGIN },
    }),
    next: { revalidate: REVALIDATE },
  })
  if (!res.ok) throw new Error(`GitHub GraphQL responded ${res.status}`)

  const calendar = ((await res.json()) as CalendarResponse).data?.user?.contributionsCollection
    .contributionCalendar
  if (!calendar) throw new Error("GitHub GraphQL returned no calendar")

  return calendar.weeks.flatMap((week) =>
    week.contributionDays.map((day) => ({
      date: day.date,
      count: day.contributionCount,
      level: GRAPHQL_LEVELS[day.contributionLevel] ?? 0,
    }))
  )
}

/* the public page renders each day as a <td data-date data-level id> and puts
   the count in a <tool-tip for=id> ("8 contributions on September 5th.") */
async function fromPublicPage(): Promise<ContributionDay[]> {
  const res = await fetch(`https://github.com/users/${LOGIN}/contributions`, {
    headers: { "User-Agent": "cnet-portfolio" },
    next: { revalidate: REVALIDATE },
  })
  if (!res.ok) throw new Error(`GitHub contributions page responded ${res.status}`)
  const html = await res.text()

  const counts = new Map<string, number>()
  for (const match of html.matchAll(/<tool-tip[^>]*\sfor="([^"]+)"[^>]*>\s*([^<]*)/g)) {
    const leading = /^([\d,]+) contribution/.exec(match[2])
    counts.set(match[1], leading ? Number(leading[1].replaceAll(",", "")) : 0)
  }

  const days: ContributionDay[] = []
  for (const match of html.matchAll(/<td\b[^>]*\bdata-date="([^"]+)"[^>]*>/g)) {
    const tag = match[0]
    const id = /\bid="([^"]+)"/.exec(tag)?.[1]
    const level = Number(/\bdata-level="(\d)"/.exec(tag)?.[1] ?? 0)
    days.push({
      date: match[1],
      count: id ? (counts.get(id) ?? 0) : 0,
      level: Math.min(4, Math.max(0, level)) as ContributionLevel,
    })
  }
  if (days.length === 0) throw new Error("GitHub contributions page had no calendar")

  return days.sort((a, b) => a.date.localeCompare(b.date))
}

export async function GET() {
  try {
    const token = process.env.GITHUB_TOKEN
    const days = token ? await fromGraphql(token) : await fromPublicPage()
    const body: Contributions = {
      login: LOGIN,
      total: days.reduce((sum, day) => sum + day.count, 0),
      days,
      fetchedAt: new Date().toISOString(),
    }
    return NextResponse.json(body, {
      headers: { "Cache-Control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=3600` },
    })
  } catch (error) {
    console.error("[github/contributions]", error)
    return NextResponse.json({ error: "GitHub contributions unavailable" }, { status: 502 })
  }
}
