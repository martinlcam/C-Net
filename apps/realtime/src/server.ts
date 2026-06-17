import type { ServerWebSocket } from "bun"
import { bayViewKey, ingestKey, tokensMatch } from "./auth"
import { startBus } from "./redis-bus"

/**
 * apps/realtime — fan-out service.
 *
 *  bridge (Python)    --PUBLISH bd:samples-->  Redis --SUB--> [this] --WS--> /bd/live
 *  cnet-bayd (host)   --PUBLISH bay:status-->  Redis --SUB--> [this] --WS--> /bay/live
 *
 * Two independent fan-outs sharing one Redis subscriber:
 *  - bd:samples + bd:status  -> topic "bd"  -> /bd/live  (public EEG viewer)
 *  - bay:status              -> topic "bay" -> /bay/live (token-gated; storage data)
 */

const PORT = Number(process.env.REALTIME_PORT || 4002)
const CH_SAMPLES = process.env.BD_REDIS_CHANNEL_SAMPLES || "bd:samples"
const CH_STATUS = process.env.BD_REDIS_CHANNEL_STATUS || "bd:status"
const CH_BAY = process.env.BAY_REDIS_CHANNEL || "bay:status"
const TOPIC_BD = "bd"
const TOPIC_BAY = "bay"
const SERVER_START_TS = Date.now()

type ClientRole = "viewer" | "ingest"
type ClientData = { role: ClientRole; id: string; topic: string; openedAt: number }

const viewers = new Set<ServerWebSocket<ClientData>>()
const publishers = new Set<ServerWebSocket<ClientData>>()

let nextClientId = 1
const genId = (prefix: string) => `${prefix}-${(nextClientId++).toString(36)}`

// Redis -> WS fan-out. Route bay frames to the bay topic, everything else to bd.
const bus = startBus([CH_SAMPLES, CH_STATUS, CH_BAY], (channel, payload) => {
  const topic = channel === CH_BAY ? TOPIC_BAY : TOPIC_BD
  server.publish(topic, payload)
})

function helloFor(topic: string): string {
  return JSON.stringify({ t: "hello", ts: Date.now(), serverStartTs: SERVER_START_TS, topic })
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
        data: { role: "viewer", id: genId("v"), topic: TOPIC_BD, openedAt: Date.now() },
      })
      return ok ? undefined : new Response("expected websocket upgrade", { status: 426 })
    }

    // Storage bay telemetry — token-gated (the API hands the key to a superuser).
    if (url.pathname === "/bay/live") {
      const token = url.searchParams.get("token") || ""
      if (!tokensMatch(token, bayViewKey())) {
        return new Response("unauthorized", { status: 401 })
      }
      const ok = srv.upgrade(req, {
        data: { role: "viewer", id: genId("b"), topic: TOPIC_BAY, openedAt: Date.now() },
      })
      return ok ? undefined : new Response("expected websocket upgrade", { status: 426 })
    }

    if (url.pathname === "/bd/ingest") {
      const token = url.searchParams.get("token") || ""
      if (!tokensMatch(token, ingestKey())) {
        return new Response("unauthorized", { status: 401 })
      }
      const ok = srv.upgrade(req, {
        data: { role: "ingest", id: genId("p"), topic: TOPIC_BD, openedAt: Date.now() },
      })
      return ok ? undefined : new Response("expected websocket upgrade", { status: 426 })
    }

    return new Response("not found", { status: 404 })
  },

  websocket: {
    maxPayloadLength: 256 * 1024,

    open(ws) {
      if (ws.data.role === "viewer") {
        viewers.add(ws)
        ws.subscribe(ws.data.topic)
        ws.send(helloFor(ws.data.topic))
        console.log(`[rt] viewer +1 (${ws.data.id}, ${ws.data.topic}) total=${viewers.size}`)
      } else {
        publishers.add(ws)
        console.log(`[rt] publisher +1 (${ws.data.id}) total=${publishers.size}`)
      }
    },

    async message(ws, raw) {
      if (ws.data.role !== "ingest") return

      const text =
        typeof raw === "string"
          ? raw
          : raw instanceof Buffer
            ? raw.toString("utf8")
            : new TextDecoder().decode(raw as Uint8Array)

      if (!text || text.length > 256 * 1024) return

      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        return
      }
      if (!parsed || typeof parsed !== "object" || !("t" in parsed)) return
      const t = (parsed as { t: unknown }).t
      const channel = t === "status" ? CH_STATUS : t === "sample" ? CH_SAMPLES : null
      if (!channel) return

      try {
        await bus.publish(channel, text)
      } catch (err) {
        console.error("[rt] publish failed:", (err as Error).message)
      }
    },

    close(ws) {
      if (ws.data.role === "viewer") {
        viewers.delete(ws)
        console.log(`[rt] viewer -1 (${ws.data.id}) total=${viewers.size}`)
      } else {
        publishers.delete(ws)
        console.log(`[rt] publisher -1 (${ws.data.id}) total=${publishers.size}`)
      }
    },
  },
})

console.log(
  `[rt] realtime up on :${PORT}  channels=[${CH_SAMPLES}, ${CH_STATUS}, ${CH_BAY}]  topics=[${TOPIC_BD}, ${TOPIC_BAY}]`
)

const shutdown = async (sig: string) => {
  console.log(`[rt] ${sig} — closing`)
  await bus.close()
  server.stop()
  process.exit(0)
}
process.on("SIGINT", () => void shutdown("SIGINT"))
process.on("SIGTERM", () => void shutdown("SIGTERM"))
