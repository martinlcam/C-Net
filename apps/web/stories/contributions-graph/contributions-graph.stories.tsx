import type { Meta, StoryObj } from "@storybook/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ContributionsGraph } from "../../app/(portfolio)/components/ContributionsGraph"

/* the graph fetches /api/github/contributions; the stories answer that
   request themselves with a made-up year so no server is needed */
function fakeYear() {
  const days = []
  const start = new Date()
  start.setDate(start.getDate() - 370)
  for (let i = 0; i <= 370; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const busy = d.getDay() > 0 && d.getDay() < 6 ? 0.55 : 0.2
    const count = Math.random() < busy ? Math.floor(Math.random() ** 2 * 14) + 1 : 0
    const level = count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4
    days.push({ date: d.toISOString().slice(0, 10), count, level })
  }
  return { login: "storybook", total: days.reduce((sum, day) => sum + day.count, 0), days }
}

function withAnswer(status: number, body: unknown) {
  return (Story: () => React.ReactNode) => {
    const realFetch = window.fetch
    window.fetch = (input, init) =>
      String(input).endsWith("/api/github/contributions")
        ? Promise.resolve(new Response(JSON.stringify(body), { status }))
        : realFetch(input, init)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return (
      <QueryClientProvider client={client}>
        <div
          style={{
            position: "relative",
            width: 631,
            height: 190,
            background: "#fff",
            outline: "1px solid #161616",
          }}
        >
          <Story />
        </div>
      </QueryClientProvider>
    )
  }
}

const meta: Meta<typeof ContributionsGraph> = {
  title: "Portfolio/ContributionsGraph",
  component: ContributionsGraph,
  parameters: { layout: "centered" },
  args: { title: "Ancient Paintings" },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [withAnswer(200, fakeYear())],
}

export const Unavailable: Story = {
  decorators: [withAnswer(502, { error: "GitHub contributions unavailable" })],
}
