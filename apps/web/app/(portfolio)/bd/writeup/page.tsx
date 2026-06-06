"use client"

import { Text } from "@radix-ui/themes"
import katex from "katex"
import "katex/dist/katex.min.css"
import Link from "next/link"
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter"
import python from "react-syntax-highlighter/dist/esm/languages/prism/python"
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { AuthModal } from "@/components/AuthModal"
import { FooterSection } from "../../sections/FooterSection"
import { HeaderSection } from "../../sections/HeaderSection"

export default function BdWriteupPage() {
  return (
    <div className="min-h-screen w-full bg-[#faf6f1] text-gray-900">
      <AuthModal />
      <HeaderSection />
      <div className="h-[65px]" aria-hidden="true" />

      <article className="mx-auto max-w-2xl px-6 py-16 md:py-24">
        <Link
          href="/bd"
          className="inline-block mb-10 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          ← Back to BD
        </Link>

        <header className="mb-12">
          <h1 className="font-satoshi text-4xl md:text-5xl font-bold tracking-tight leading-[1.05]">
            Braindance: putting my brain on the internet
          </h1>
          <p className="mt-4 text-sm uppercase tracking-[0.2em] text-gray-400">
            Martin · June 4, 2026
          </p>
        </header>

        <Prose>
          <p>
            Hey, I’m Martin. This is the story of how I got my brainwaves streaming live onto this
            website, and fuck I tried to get AI to write this but its genuinley horrible.
          </p>
          <p className="line-through">
            I’d wanted to do this for a while — a little corner of my portfolio that’s just… me,
            live. Not a project screenshot, not a case study. The actual electrical activity coming
            off my head, right now, painted onto a screen. I call it BD, short for Braindance (yeah,
            it’s a Cyberpunk reference). The long-term dream is bigger: train a model on these
            signals and let my brain trigger things on my computer. Brain in, control out. But you
            have to crawl before you run, and step one was just this — get the data flowing.
          </p>

          <p>deadass who writes like this</p>

          <H2>The pipe</H2>
          <p>
            Huge shoutout to my good friend{" "}
            <a
              href="https://www.flatypus.me/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              <Text color="cyan">Hinson</Text>
            </a>{" "}
            for supplying me with the EEG hardware, the only blocker for this project initially.
            Apprently he klepped it at a flea market wayy back.
          </p>
          <p>
            The EEG headband talks Bluetooth to a little Python program -- the “bridge.” The bridge
            shoves each batch of samples into Redis; specifically Redis pub/sub, which is less
            “database” and more “loudspeaker.” You publish a message, everyone listening hears it
            instantly, and then it’s gone. A tiny Bun server subscribes to that loudspeaker and fans
            the data out over WebSockets to your browser.
          </p>
          <p>
            I am quite proud of the fact that none of the pieces know about each other. The bridge
            doesn’t know browsers exist. The browser doesn’t know Python exists. They both just talk
            to Redis. Which means when I eventually build the brain-control model, it just…
            subscribes to the same loudspeaker. No rewrites.
          </p>
          <CodeBlock label="bridge · publisher.py" lang="python" code={CODE_BRIDGE} />
          <CodeBlock label="realtime + browser" lang="typescript" code={CODE_RELAY} />

          <H2>Bluetooth hell</H2>
          <p>Getting a consumer EEG headband to talk to a Windows desktop is...interesting.</p>
          <p>
            The headband showed up in about every scan. Strong signal, sitting right next to me. But
            every single time I tried to actually connect, it would get partway in and then die with
            the same error -- <em>“Could not get GATT services: Unreachable.”</em> The Bluetooth
            equivalent of someone picking up the phone and immediately hanging up.
          </p>
          <p>
            Yeah Claude sat down with this one for like 2 hours. I thought it was a pairing problem,
            so I tried pairing it in Windows settings -- turns out Windows had “advanced discovery”
            switched off and literally couldn’t see the thing. Turned that on, tried to pair, got
            “try connecting your device again.” Tried pairing it programmatically through the raw
            Windows API. Failed. I updated the Bluetooth driver from 2022 all the way to 2026. I ran
            system repair tools, because it turned out a Windows update had half-installed itself
            and quietly corrupted things. Last place to look was the card
          </p>
          <p>
            It wasn’t the card. The card was fine. The real culprit was the chipset: my desktop has
            a MediaTek Bluetooth adapter, and MediaTek’s handling of this particular flavor of
            Bluetooth on Windows is famously broken. I installed a completely different,
            purpose-built Muse program, and it failed in the <em>exact</em> same place. Two
            unrelated pieces of software, same wall.
          </p>

          <H2>The pivot</H2>
          <p>Truth be told I probably should have done it this way to begin with.</p>
          <p>
            I have a Proxmox box -- basically a little server heating my room -- and it has an Intel
            Bluetooth adapter. Intel and Linux together don’t have any of Windows’ hangups. I cloned
            the project over, ran the bridge, and it also didnt run. Turns out that the{" "}
            <a
              href="https://www.alexng.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              <Text color="cyan">goofy ahh</Text>
            </a>{" "}
            that sold me the motherboard for this server didnt sell me bluetooth atennas. Tinfoil
            wrapped around the contacts got me though.
          </p>

          <H2>Wait, what is this thing?</H2>
          <p>
            Fun plot twist. I’d assumed the whole time I had a Muse 2. I pulled the device’s
            identity straight off its control channel and -- nope. It’s the <em>original</em> Muse,
            the 2016 model. No heart-rate sensor, four EEG channels, older than I thought. Which
            explained a few things, and means the heart-rate dial on the page is just always going
            to read “—.” Honestly, kind of charming that the thing reading my brain is nearly a
            decade old.
          </p>
          <CodeBlock label="bridge · publisher.py" lang="python" code={CODE_RESUME} />
          <p>
            One last nit. On Linux you can’t connect to a Bluetooth device while you’re also
            scanning for it -- they fight over the radio. Once I learned to stop scanning{" "}
            <em>before</em> connecting, the link finally held.
          </p>
          <CodeBlock label="bridge · publisher.py" lang="python" code={CODE_BLUEZ} />

          <H2>Reading the readout</H2>

          <p>
            <strong>The waveforms (µV).</strong> Each trace is a voltage at one electrode, in
            microvolts. The headband’s 12-bit ADC hands the bridge a number from 0–4095, which maps
            to a real voltage centered on zero:
          </p>
          <MathBlock
            tex={String.raw`V \;=\; (\text{raw} - 2048)\,\times\,0.48828125\ \ \mu\text{V}`}
          />
          <p>
            Brain signals are tiny -- tens of µV -- so the per-channel{" "}
            <em>FLAT&nbsp;/&nbsp;OK&nbsp;/&nbsp;HOT</em> tag is just the standard deviation of the
            trace over the last second:
          </p>
          <MathBlock
            tex={String.raw`\sigma \;=\; \sqrt{\frac{1}{N}\sum_{i=1}^{N}\bigl(x_i-\mu\bigr)^2}\,,
              \qquad \mu=\frac{1}{N}\sum_{i=1}^{N}x_i`}
          />
          <p>
            Near-zero spread (<MathInline tex={String.raw`\sigma < 2\,\mu\text{V}`} />) means the
            pad isn’t touching skin; a giant spread means it’s railing. Real EEG lives in between.
          </p>
          <p>
            Those traces are just the ring buffer painted onto a canvas -- once per animation frame
            we walk the most recent samples, auto-scale each channel into its own lane, and stroke
            the line:
          </p>
          <CodeBlock label="web · EegOscilloscope.tsx" lang="typescript" code={CODE_DRAW} />

          <p>
            <strong>The bands (δ θ α β γ).</strong> Slice that signal by frequency and you get the
            classic EEG bands:
          </p>
          <MathBlock
            tex={String.raw`\underbrace{\delta}_{1\text{–}4}\ \ \underbrace{\theta}_{4\text{–}8}\ \
              \underbrace{\alpha}_{8\text{–}13}\ \ \underbrace{\beta}_{13\text{–}30}\ \
              \underbrace{\gamma}_{30\text{–}44}\quad[\text{Hz}]`}
          />
          <p>
            Loosely: delta = deep sleep, theta = drowsy/meditative, alpha = relaxed with eyes
            closed, beta = alert and thinking, gamma = fast stuff (and, on a consumer headband, a
            pile of muscle noise). The “power” in a band is the area under the power spectral
            density <MathInline tex="S(f)" /> across that range:
          </p>
          <MathBlock
            tex={String.raw`P_{\text{band}} \;=\; \int_{f_{\text{lo}}}^{f_{\text{hi}}} S(f)\,df
              \quad\bigl[\mu\text{V}^2\bigr]`}
          />
          <CodeBlock label="bridge · bandpower.py" lang="python" code={CODE_BANDS} />

          <p>
            <strong>Why delta always wins -- the 1/f law.</strong> EEG power isn’t spread evenly; it
            falls off with frequency, so the low bands inherently hoard most of it:
          </p>
          <MathBlock
            tex={String.raw`S(f)\;\propto\;\frac{1}{f^{\beta}}\,,\qquad \beta\approx 1\text{–}2`}
          />
          <p>That’s why, if you show each band as a plain share of the total --</p>
          <MathBlock
            tex={String.raw`P_{\text{rel}} \;=\; \frac{P_{\text{band}}}{\sum_{b} P_{b}}\times 100\%`}
          />
          <p>
            -- delta parks at 60–80% essentially forever. That’s physics, not me being a dumbass. To
            actually <em>see</em> the quiet bands, the <strong>LOG dB</strong> toggle puts each one
            on a base-10 logarithmic scale relative to the loudest band:
          </p>
          <MathBlock
            tex={String.raw`\text{dB} \;=\; 10\,\log_{10}\!\left(\frac{P_{\text{band}}}{P_{\text{peak}}}\right)`}
          />
          <p>
            Every <MathInline tex={String.raw`10\,\text{dB}`} /> (one <em>bel</em>) is a 10× change
            in power, so <MathInline tex={String.raw`-20\,\text{dB}`} /> is a band 100× quieter than
            the loudest. The logarithm crushes that giant 1/f range flat -- alpha, beta and gamma
            stop being slivers and start moving with their own activity, which is how you can watch
            the alpha bump rise when you close your eyes.
          </p>

          <p>
            <strong>The horseshoe (HSI).</strong> The little head with four dots is contact quality
            -- “Horseshoe Indicator,” after the band’s shape. The 2016 Muse doesn’t broadcast it, so
            it’s derived from each channel’s spread (smoothed over a few seconds so a blink doesn’t
            flip it) and bucketed the way Muse does:
          </p>
          <MathBlock
            tex={String.raw`\text{HSI}(\sigma)=\begin{cases}
              4 & \sigma<2\ \text{or}\ \sigma>150\\[3pt]
              2 & \sigma<5\ \text{or}\ \sigma>60\\[3pt]
              1 & \text{otherwise}
              \end{cases}\quad[\mu\text{V}]`}
          />
          <p>
            1 = good, 2 = ok, 4 = poor. Get all four dots green and everything else on the page
            suddenly means something.
          </p>

          <H2>What’s next</H2>
          <p>
            This is just the telemetry layer. The real project is on the other side of the stream:
            feeding these signals into a model that learns my patterns and turns them into actions
            on my machine. That loop is the part I actually care about. This page is me making sure
            the wire works first -- and making it look good while I’m at it.
          </p>
          <p>Sigma Sigma Boy</p>
        </Prose>

        <div className="mt-16 border-t border-gray-200 pt-8">
          <Link
            href="/bd"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 transition-colors hover:text-[#ad70eb]"
          >
            ← Watch it live
          </Link>
        </div>
      </article>

      <FooterSection />
    </div>
  )
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6 font-satoshi text-lg leading-relaxed text-gray-800 [&_em]:text-gray-900 [&_em]:not-italic [&_em]:font-medium">
      {children}
    </div>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-satoshi text-2xl md:text-3xl font-bold tracking-tight text-gray-900 pt-6">
      {children}
    </h2>
  )
}

/** Display equation — KaTeX-typeset, in a tinted block with a purple accent rail. */
function MathBlock({ tex }: { tex: string }) {
  const html = katex.renderToString(tex, { displayMode: true, throwOnError: false })
  return (
    <div
      className="my-6 overflow-x-auto rounded-md border-l-2 border-[#ad70eb]/40 bg-black/[0.02] px-4 py-3 text-gray-900"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted local KaTeX output.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/** Inline equation — KaTeX-typeset, flows with the surrounding text. */
function MathInline({ tex }: { tex: string }) {
  const html = katex.renderToString(tex, { displayMode: false, throwOnError: false })
  // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted local KaTeX output.
  return <span className="text-gray-900" dangerouslySetInnerHTML={{ __html: html }} />
}

SyntaxHighlighter.registerLanguage("python", python)
SyntaxHighlighter.registerLanguage("typescript", typescript)

/** Syntax-highlighted code block — dark Prism theme against the cream page. */
function CodeBlock({
  code,
  lang = "python",
  label,
}: {
  code: string
  lang?: string
  label?: string
}) {
  return (
    <div className="my-6 overflow-hidden rounded-md border border-black/10 bg-[#282c34]">
      {label ? (
        <div className="px-4 pt-3 pb-1 font-bd-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">
          {label}
        </div>
      ) : null}
      <SyntaxHighlighter
        language={lang}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: label ? "0.35rem 1.1rem 1rem" : "1rem 1.1rem",
          background: "#282c34",
          fontSize: "0.92rem",
          lineHeight: 1.6,
          overflowX: "auto",
        }}
        codeTagProps={{ style: { fontFamily: "var(--font-bd-mono), ui-monospace, monospace" } }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

const CODE_BRIDGE = `# subscribe to each EEG electrode -- every BLE notification is decoded + buffered
for uuid in (TP9, AF7, AF8, TP10):
    await client.start_notify(uuid, on_eeg)

def on_eeg(sender, data: bytearray):
    pkt = decode_eeg(data)                 # 12-bit packed payload -> microvolts
    slot = buf.eeg_by_seq[pkt.sequence]    # align the 4 channels by packet number
    slot[EEG_CHANNEL_INDEX[sender.uuid]] = pkt.samples_uv

# ~10x a second: drain the aligned samples and shove a frame into Redis
while client.is_connected:
    await asyncio.sleep(0.1)
    eeg = drain_aligned(buf)               # [[tp9, af7, af8, tp10], ...]
    redis.publish("bd:samples", json.dumps({"t": "sample", "eeg": eeg}))`

const CODE_RELAY = `// realtime (Bun): forward everything on the Redis channels to every WS viewer
redisSub.subscribe("bd:samples", "bd:status")
redisSub.on("message", (_channel, payload) => server.publish("bd", payload))

// browser: each WebSocket message becomes a typed frame, routed by its \`t\`
ws.onmessage = (ev) => {
  const frame = JSON.parse(ev.data)
  if (frame.t === "sample") ingest(buffer, frame)        // -> ring buffer
  else if (frame.t === "bands") buffer.latestBands = frame
}`

const CODE_RESUME = `# the 2016 Muse drops the link on 'halt' and ignores presets;
# it just needs the resume command ('d') to start streaming.
await client.write_gatt_char(STREAM_TOGGLE, CMD_RESUME, response=False)`

const CODE_BLUEZ = `# connecting by address string makes BlueZ run its own scan, which
# fights the active one and hangs. resolve to a device object first:
device = await BleakScanner.find_device_by_address(address)
async with BleakClient(device) as client:   # connect to the object, not the string
    ...`

const CODE_DRAW = `// oscilloscope: once per animation frame, walk the ring buffer and draw 4 lanes
for (let c = 0; c < 4; c++) {
  ctx.beginPath()
  for (let i = 0; i < onScreen; i++) {
    const s = ring.samples[(ring.head - onScreen + i + ring.cap) % ring.cap]
    const x = i * stepX
    const y = laneMid[c] - (s[c] / peak[c]) * amp        // auto-scaled into the lane
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.stroke()
}`

const CODE_BANDS = `# bridge: absolute per-channel band power via BrainFlow, ~5x a second
bands = []
for ch in window.T:                                  # each of the 4 EEG channels
    DataFilter.detrend(ch, LINEAR)
    DataFilter.perform_highpass(ch, 256, 0.5, 2, BUTTERWORTH, 0)     # kill drift
    DataFilter.perform_bandstop(ch, 256, 58, 62, 2, BUTTERWORTH, 0)  # mains notch
    psd = DataFilter.get_psd_welch(ch, nfft, nfft // 2, 256, HANNING)
    bands.append([get_band_power(psd, lo, hi) for lo, hi in BANDS])  # delta..gamma
redis.publish("bd:samples", json.dumps({"t": "bands", "abs": bands}))`
