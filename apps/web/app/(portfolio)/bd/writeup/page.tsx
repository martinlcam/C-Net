"use client"

import Link from "next/link"
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
            Hey, I’m Martin. This is the story of how I got my brainwaves streaming live onto
            this website, and all the ways it went wrong before it went right. Fair warning:
            most of this is a Bluetooth horror story with a happy ending.
          </p>
          <p>
            I’d wanted to do this for a while — a little corner of my portfolio that’s just…
            me, live. Not a project screenshot, not a case study. The actual electrical activity
            coming off my head, right now, painted onto a screen. I call it BD, short for
            Braindance (yeah, it’s a Cyberpunk reference). The long-term dream is bigger: train
            a model on these signals and let my brain trigger things on my computer. Brain in,
            control out. But you have to crawl before you run, and step one was just this — get
            the data flowing.
          </p>

          <H2>The pipe</H2>
          <p>
            The plan was clean on paper. A Muse EEG headband talks Bluetooth to a little Python
            program — the “bridge.” The bridge shoves each batch of samples into Redis;
            specifically Redis pub/sub, which is less “database” and more “loudspeaker.” You
            publish a message, everyone listening hears it instantly, and then it’s gone. A tiny
            Bun server subscribes to that loudspeaker and fans the data out over WebSockets to
            your browser. Nothing is ever stored. You’re watching the pipe, not a recording.
          </p>
          <p>
            The thing I’m quietly proud of is that none of the pieces know about each other. The
            bridge doesn’t know browsers exist. The browser doesn’t know Python exists. They
            both just talk to Redis. Which means when I eventually build the brain-control model,
            it just… subscribes to the same loudspeaker. No rewrites.
          </p>
          <p>
            So I built the whole front end first, faked the data, and made it look the way I
            wanted — sharp, high-contrast, a bit brutalist, with a radioactive-lime trace that
            says “this is alive.” Then I went to plug in the actual headband. And that’s where I
            lost about a day of my life.
          </p>

          <H2>Bluetooth hell</H2>
          <p>
            Here’s what nobody tells you: getting a consumer EEG headband to talk to a Windows
            desktop is genuinely cursed.
          </p>
          <p>
            The headband showed up in every scan. Strong signal, sitting right next to me. But
            every single time I tried to actually connect, it would get partway in and then die
            with the same useless error — <em>“Could not get GATT services: Unreachable.”</em>{" "}
            The Bluetooth equivalent of someone picking up the phone and immediately hanging up.
          </p>
          <p>
            I went down every rabbit hole. I thought it was a pairing problem, so I tried pairing
            it in Windows settings — turns out Windows had “advanced discovery” switched off and
            literally couldn’t see the thing. Turned that on, tried to pair, got “try connecting
            your device again.” Tried pairing it programmatically through the raw Windows API.
            Failed. I updated the Bluetooth driver from 2022 all the way to 2026. I ran system
            repair tools, because it turned out a Windows update had half-installed itself and
            quietly corrupted things. At one point I genuinely asked, out loud, “is the card
            cooked?”
          </p>
          <p>
            It wasn’t the card. The card was fine. The real culprit was the chipset: my desktop
            has a MediaTek Bluetooth adapter, and MediaTek’s handling of this particular flavor
            of Bluetooth on Windows is famously broken. I proved it in the most satisfying way
            possible — I installed a completely different, purpose-built Muse program, and it
            failed in the <em>exact</em> same place. Two unrelated pieces of software, same wall.
            It was never my code. It was never going to work on that machine.
          </p>

          <H2>The pivot</H2>
          <p>
            The fix turned out to be embarrassingly simple in hindsight: use Linux.
          </p>
          <p>
            I have a Proxmox box — basically a little server humming away in my homelab — and it
            has an Intel Bluetooth adapter. Intel and Linux together don’t have any of Windows’
            hangups. I cloned the project over, ran the bridge, and it connected on the first
            try. After a full day of fist-fighting Windows, Linux just… did it. I sat there a
            little stunned.
          </p>

          <H2>Wait, what is this thing?</H2>
          <p>
            Right when I thought I was home free, a fun plot twist. I’d assumed the whole time I
            had a Muse 2. We pulled the device’s identity straight off its control channel and —
            nope. It’s the <em>original</em> Muse, the 2016 model. No heart-rate sensor, four EEG
            channels, older than I thought. Which explained a few things, and means the
            heart-rate dial on the page is just always going to read “—.” Honestly, kind of
            charming that the thing reading my brain is nearly a decade old.
          </p>
          <p>
            There was one last gremlin. On Linux you can’t connect to a Bluetooth device while
            you’re also scanning for it — they fight over the radio. Once I learned to stop
            scanning <em>before</em> connecting, the link finally held.
          </p>

          <H2>Live</H2>
          <p>
            And then it worked. Four wobbling lines on a black screen, and they’re mine. I closed
            my eyes and watched the alpha band climb — that’s the textbook “yes, this is really a
            brain” signature — and there it was.
          </p>
          <p>
            It is a genuinely strange feeling to look at a number on a screen and know that it’s a
            thought, or at least the electrical weather of one.
          </p>

          <H2>What’s next</H2>
          <p>
            This is just the telemetry layer. The real project is on the other side of the
            stream: feeding these signals into a model that learns my patterns and turns them
            into actions on my machine. That loop is the part I actually care about. This page is
            me making sure the wire works first — and making it look good while I’m at it.
          </p>
          <p>Anyway. My brain’s up there now. Thanks for reading.</p>
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
