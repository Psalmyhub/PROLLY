"use client";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="text-2xl font-bold tracking-tight">
          PROLLY<span className="text-violet-400">.</span>
        </div>

        <div className="hidden items-center gap-8 text-sm text-zinc-300 md:flex">
          <a href="#how-it-works" className="hover:text-white">
            How it works
          </a>
          <a href="#prollys" className="hover:text-white">
            Prollys
          </a>
          <a href="#sponsors" className="hover:text-white">
            Sponsors
          </a>
        </div>

        <button
          type="button"
          className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium hover:bg-zinc-800"
          onClick={() => alert("Wallet connection will be added next.")}
        >
          Connect Wallet
        </button>
      </nav>

      <section className="mx-auto flex max-w-7xl flex-col items-center px-6 pb-24 pt-20 text-center md:pt-32">
        <div className="mb-6 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm text-violet-300">
          Transparent. Random. On-chain.
        </div>

        <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
          Your chance.
          <br />
          Your <span className="text-violet-400">Prolly.</span>
        </h1>

        <p className="mt-8 max-w-2xl text-lg leading-8 text-zinc-400">
          Join a Prolly, enter with the required amount, and let transparent
          random selection determine the winners. No skill. No favoritism.
          Just probability.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/prollys"
            className="rounded-full bg-violet-500 px-8 py-4 font-semibold text-white hover:bg-violet-400"
          >
            Explore Prollys
          </Link>

          <Link
            href="/admin"
            className="rounded-full border border-zinc-700 px-8 py-4 font-semibold text-white hover:bg-zinc-900"
          >
            Create a Prolly
          </Link>
        </div>
      </section>

      <section
        id="how-it-works"
        className="border-y border-zinc-800 bg-zinc-900/40"
      >
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
              How it works
            </p>

            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
              Simple by design.
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                number: "01",
                title: "Join",
                text: "Choose an active Prolly and enter with the required amount.",
              },
              {
                number: "02",
                title: "Wait",
                text: "The Prolly automatically closes when its conditions are met.",
              },
              {
                number: "03",
                title: "Win",
                text: "Winners are selected through a transparent random process.",
              },
            ].map((step) => (
              <div
                key={step.number}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8"
              >
                <div className="text-sm font-semibold text-violet-400">
                  {step.number}
                </div>

                <h3 className="mt-6 text-xl font-semibold">{step.title}</h3>

                <p className="mt-3 leading-7 text-zinc-400">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="prollys" className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8">
            <p className="text-sm font-semibold text-violet-400">
              FOR PARTICIPANTS
            </p>

            <h2 className="mt-4 text-3xl font-bold">
              Join a live Prolly.
            </h2>

            <p className="mt-4 leading-7 text-zinc-400">
              Discover active Prollys, see the entry amount, participants,
              prize pool and number of winners before you enter.
            </p>

            <Link
              href="/prollys"
              className="mt-8 inline-block rounded-full bg-white px-6 py-3 font-semibold text-black hover:bg-zinc-200"
            >
              Browse Prollys
            </Link>
          </div>

          <div
            id="sponsors"
            className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8"
          >
            <p className="text-sm font-semibold text-violet-400">
              FOR SPONSORS
            </p>

            <h2 className="mt-4 text-3xl font-bold">
              Randomize your community.
            </h2>

            <p className="mt-4 leading-7 text-zinc-400">
              Use Prolly to randomly select recipients for NFTs, tokens,
              whitelists, giveaways and community campaigns.
            </p>

            <Link
              href="/admin"
              className="mt-8 inline-block rounded-full border border-zinc-700 px-6 py-3 font-semibold hover:bg-zinc-800"
            >
              Sponsor a Prolly
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Prolly. Built for transparent probability.</p>
          <p>Open source • Transparent • Random</p>
        </div>
      </footer>
    </main>
  );
}
