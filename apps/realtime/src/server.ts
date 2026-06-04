import type { ServerWebSocket } from "bun"
import { ingestKey, tokensMatch } from "./auth"
import { startBus } from "./redis-bus"

/**
 * apps/realtime — the Braindance fan-out service.
 *
 *  bridge (Python, bleak)    ---PUBLISH bd:samples-->   Redis
 *                                                          |
 *                                                          v
 *  [this Bun process] <---SUBSCRIBE bd:samples,bd:status---/
 *      |
 *      ws.publish("bd", payload)
 *      |
 *      v
 *  every connected viewer at /bd/live
 *
 * The HTTP surface is tiny: `/health`, `/bd/live` (viewer), `/bd/ingest`
 * (publisher, token-gated). All frames are JSON-strings whose shape matches
 * `BdFrame` in apps/web — both sides intentionally never reshape them.
 */

const PORT = Number(process.env.REALTIME_PORT || 4002)
const CH_SAMPLES = process.env.BD_REDIS_CHANNEL_SAMPLES || "bd:samples"
const CH_STATUS = process.env.BD_REDIS_CHANNEL_STATUS || "bd:status"
const TOPIC = "bd"
const SERVER_START_TS = Date.now()

type ClientRole = "viewer" | "ingest"
type ClientData = { role: ClientRole; id: string; openedAt: number }

const viewers = new Set<ServerWebSocket<ClientData>>()
const publishers = new Set<ServerWebSocket<ClientData>>()

let nextClientId = 1
const genId = (prefix: string) => `${prefix}-${(nextClientId++).toString(36)}`

// Redis -> WS fan-out. Validate it's a non-empty string and broadcast as-is.
const bus = startBus([CH_SAMPLES, CH_STATUS], (_channel, payload) => {
  if (server.publish(TOPIC, payload) === 0) {
    // No viewers — silently drop (ephemeral, by design).
  }
})

function helloFor(_ws: ServerWebSocket<ClientData>): string {
  return JSON.stringify({
    t: "hello",
    ts: Date.now(),
    serverStartTs: SERVER_START_TS,
    viewerCount: viewers.size,
  })
}

const server = Bun.serve<ClientData>({
  port: PORT,
  fetch(req, srv) {
    const url = new URL(req.url)

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          ok: true,
          uptimeMs: Date.now() - SERVER_START_TS,
          viewers: viewers.size,
          publishers: publishers.size,
        }),
        { headers: { "content-type": "application/json" } }
      )
    }

    if (url.pathname === "/bd/live") {
      const ok = srv.upgrade(req, {
        data: { role: "viewer", id: genId("v"), openedAt: Date.now() },
      })
      return ok
        ? undefined
        : new Response("expected websocket upgrade", { status: 426 })
    }

    if (url.pathname === "/bd/ingest") {
      const token = url.searchParams.get("token") || ""
      if (!tokensMatch(token, ingestKey())) {
        return new Response("unauthorized", { status: 401 })
      }
      const ok = srv.upgrade(req, {
        data: { role: "ingest", id: genId("p"), openedAt: Date.now() },
      })
      return ok
        ? undefined
        : new Response("expected websocket upgrade", { status: 426 })
    }

    return new Response("not found", { status: 404 })
  },

  websocket: {
    // Allow ~256 KB per message; one batched 100ms frame is well under that.
    maxPayloadLength: 256 * 1024,

    open(ws) {
      if (ws.data.role === "viewer") {
        viewers.add(ws)
        ws.subscribe(TOPIC)
        ws.send(helloFor(ws))
        console.log(`[bd] viewer +1 (${ws.data.id}) total=${viewers.size}`)
      } else {
        publishers.add(ws)
        console.log(`[bd] publisher +1 (${ws.data.id}) total=${publishers.size}`)
      }
    },

    async message(ws, raw) {
      // Viewers are not allowed to push anything upstream.
      if (ws.data.role !== "ingest") return

      // Bun gives us string OR Buffer depending on the frame type. Normalize.
      const text =
        typeof raw === "string"
          ? raw
          : raw instanceof Buffer
            ? raw.toString("utf8")
            : new TextDecoder().decode(raw as ArrayBufferView)

      if (!text || text.length > 256 * 1024) return

      // Cheap shape check so we don't relay garbage to viewers.
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        return
      }
      if (!parsed || typeof parsed !== "object" || !("t" in parsed)) return
      const t = (parsed as { t: unknown }).t
      const channel =
        t === "status" ? CH_STATUS : t === "sample" ? CH_SAMPLES : null
      if (!channel) return

      // Republish to Redis. The bus subscriber loop will deliver it back to
      // every connected viewer (including any sibling realtime instances).
      try {
        await bus.publish(channel, text)
      } catch (err) {
        console.error("[bd] publish failed:", (err as Error).message)
      }
    },

    close(ws) {
      if (ws.data.role === "viewer") {
        viewers.delete(ws)
        console.log(`[bd] viewer -1 (${ws.data.id}) total=${viewers.size}`)
      } else {
        publishers.delete(ws)
        console.log(`[bd] publisher -1 (${ws.data.id}) total=${publishers.size}`)
      }
    },
  },
})

console.log(
  `[bd] realtime up on :${PORT}  channels=[${CH_SAMPLES}, ${CH_STATUS}]  topic=${TOPIC}`
)

const shutdown = async (sig: string) => {
  console.log(`[bd] ${sig} — closing`)
  await bus.close()
  server.stop()
  process.exit(0)
}
process.on("SIGINT", () => void shutdown("SIGINT"))
process.on("SIGTERM", () => void shutdown("SIGTERM"))
