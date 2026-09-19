"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { getOnChainProlly, getParticipants, getWinners, hasJoinedProlly, type OnChainProlly } from "@/lib/genlayer";
import { getProfileDisplayName, loadProfile } from "@/lib/profile-store";
import { loadProllys, type Prolly } from "@/lib/prolly-store";

type StoryEvent = {
  text: string;
  emoji: string;
  winner: boolean;
  wallet?: string;
  names?: string[];
};

const LOSER_EVENTS = [
  { text: "{name} was boxed by a kangaroo.", emoji: "🥊🦘" },
  { text: "{name} was caught in a sudden ambush.", emoji: "🪤⚡" },
  { text: "{name} was eliminated during the final chase.", emoji: "🏃💨" },
  { text: "{name} fell into a hidden trap.", emoji: "🕳️🪤" },
  { text: "{name} was swept away by a powerful wave.", emoji: "🌊😵" },
  { text: "{name} could not survive the collapsing bridge.", emoji: "🌉💥" },
  { text: "{name} was caught outside the safe zone.", emoji: "🚫🔴" },
  { text: "{name} was taken out in the final challenge.", emoji: "🎯💥" },
  { text: "{name} was stranded when the storm hit.", emoji: "⛈️🌪️" },
  { text: "{name} missed the final escape.", emoji: "🚪🏃" },
];

const WINNER_EVENTS = [
  { text: "{name} survived a plane crash.", emoji: "✈️💥🛡️" },
  { text: "{name} walked through the final storm and survived.", emoji: "⛈️🚶🛡️" },
  { text: "{name} escaped the final danger zone.", emoji: "🚨🏃💨" },
  { text: "{name} survived every challenge.", emoji: "🏆💪" },
  { text: "{name} made it through the chaos.", emoji: "🌪️🏆" },
  { text: "{name} reached the final safe zone.", emoji: "🛡️🏁" },
];

const DUEL_EVENTS = [
  { text: "{a} stole {b}'s food, and {b} spent the rest of the round dramatically regretting it.", emoji: "🍔😈" },
  { text: "{a} caught {b} taking the last slice. The friendship did not survive.", emoji: "🍕🏃" },
  { text: "{a} drank {b}'s entire drink and pretended nothing happened.", emoji: "🥤😤" },
  { text: "{a} blamed {b} for the missing chicken, and {b} immediately chose to run away.", emoji: "🐔😂" },
  { text: "{a} unplugged {b}'s controller at the worst possible moment. Absolute betrayal.", emoji: "🎮😈" },
  { text: "{a} discovered {b} had eaten the last cupcake. Negotiations collapsed.", emoji: "🧁🕵️" },
  { text: "{a} traded {b}'s lunch to a monkey and called it a business deal.", emoji: "🐒🍌" },
];


function hashSeed(seed: string, index: number): number {
  let hash = 2166136261;
  const value = seed + ":" + index;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function usernameFor(wallet: string, participants: string[], local: Prolly | null): string {
  const localParticipant = (local?.participantList ?? []).find(
    (p) => p.walletAddress?.toLowerCase() === wallet.toLowerCase(),
  );
  if (localParticipant?.username) return localParticipant.username;
  const profile = loadProfile(wallet);
  if (profile?.username) return profile.username;
  return getProfileDisplayName(wallet);
}

function buildStory(participants: string[], winners: string[], seed: string, local: Prolly | null): StoryEvent[] {
  const winnerSet = new Set(winners.map((w) => w.toLowerCase()));
  const losers = participants.filter((p) => !winnerSet.has(p.toLowerCase()));
  const events: StoryEvent[] = losers.map((wallet, index) => {
    const name = usernameFor(wallet, participants, local);
    const event = LOSER_EVENTS[hashSeed(seed, index) % LOSER_EVENTS.length];
    return { text: event.text.replace("{name}", name), emoji: event.emoji, winner: false, wallet, names: [name] };
  });

  for (let index = 0; index + 1 < participants.length; index += 2) {
    const first = participants[index];
    const second = participants[index + 1];
    const a = usernameFor(first, participants, local);
    const b = usernameFor(second, participants, local);
    const swap = hashSeed(seed, 5000 + index) % 2 === 1;
    const left = swap ? b : a;
    const right = swap ? a : b;
    const event = DUEL_EVENTS[hashSeed(seed, 6000 + index) % DUEL_EVENTS.length];
    events.push({
      text: event.text.replace("{a}", left).replace("{b}", right),
      emoji: event.emoji,
      winner: false,
      names: [left, right],
    });
  }

  winners.forEach((wallet, index) => {
    const name = usernameFor(wallet, participants, local);
    const event = WINNER_EVENTS[hashSeed(seed, 1000 + index) % WINNER_EVENTS.length];
    events.push({ text: event.text.replace("{name}", name), emoji: event.emoji, winner: true, wallet, names: [name] });
  });
  return events;
}

export default function ProllyBattlePage() {
  const params=useParams();
  const searchParams=useSearchParams();
  const { address }=useAccount();
  const id=String(params.id);
  const replay=searchParams.get("replay")==="1";
  const [onChain,setOnChain]=useState<OnChainProlly|null>(null);
  const [local,setLocal]=useState<Prolly|null>(null);
  const [participants,setParticipants]=useState<string[]>([]);
  const [winnerAddresses,setWinnerAddresses]=useState<string[]>([]);
  const [joined,setJoined]=useState(false);
  const [eventIndex,setEventIndex]=useState(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{let cancelled=false; (async()=>{
    try{
      setLoading(true); setError(null);
      const numericId=BigInt(id);
      const chain=await getOnChainProlly(numericId);
      if(!chain) throw new Error("This Prolly could not be found on GenLayer.");
      if(!chain.winnersFinalized) throw new Error("The Battle has not started because winners have not been finalized on-chain.");
      if(!chain.randomSeed) throw new Error("GenLayer finalized the Prolly, but its random seed is not ready.");
      const [participantList,winners,localMetadata,walletJoined]=await Promise.all([
        getParticipants(numericId.toString()),
        getWinners(numericId.toString()),
        Promise.resolve(loadProllys().find(p=>p.onChainId===id)??null),
        address ? hasJoinedProlly(numericId.toString(),address) : Promise.resolve(false),
      ]);
      if(!cancelled){setOnChain(chain);setParticipants(participantList);setWinnerAddresses(winners);setLocal(localMetadata);setJoined(walletJoined);setEventIndex(0);}
    }catch(e){if(!cancelled)setError(e instanceof Error?e.message:String(e));}
    finally{if(!cancelled)setLoading(false);}
  })(); return()=>{cancelled=true;};},[address,id]);

  const canWatch=joined||replay;
  const story=useMemo(()=>buildStory(participants,winnerAddresses,onChain?.randomSeed??"",local),[participants,winnerAddresses,onChain?.randomSeed,local]);
  const visible=story.slice(0,eventIndex);
  const finalSurvivors=winnerAddresses.map(wallet=>usernameFor(wallet,participants,local));

  useEffect(()=>{
    if(!canWatch||story.length===0)return;
    setEventIndex(0);
    const timer=window.setInterval(()=>setEventIndex(current=>{
      if(current>=story.length){window.clearInterval(timer);return current;}
      return current+1;
    }),1200);
    return()=>window.clearInterval(timer);
  },[canWatch,story.length,id]);

  if(loading)return <main className="min-h-screen bg-black text-white flex items-center justify-center"><div className="text-center"><p className="text-xs uppercase tracking-[0.3em] text-zinc-500">GenLayer Battle</p><h1 className="mt-4 text-4xl font-black">Preparing the Battle...</h1><p className="mt-3 text-zinc-500">Reading the frozen participant set and finalized winners.</p></div></main>;

  if(error||!onChain)return <main className="min-h-screen bg-black text-white px-6 py-16"><div className="mx-auto max-w-3xl rounded-3xl border border-red-500/20 bg-red-500/5 p-8"><h1 className="text-3xl font-black">Battle unavailable</h1><p className="mt-4 text-zinc-300">{error||"Unknown Prolly."}</p><Link href={`/prollys/${id}`} className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-black">Back to Prolly</Link></div></main>;

  if(!canWatch)return <main className="min-h-screen bg-black text-white px-6 py-16"><div className="mx-auto max-w-3xl rounded-3xl border border-white/10 p-8 text-center"><h1 className="text-4xl font-black">Battle access</h1><p className="mt-4 text-zinc-400">Join this Prolly or use the replay link to watch the Battle.</p><Link href={`/prollys/${id}`} className="mt-7 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-black">Back to Prolly</Link></div></main>;

  return <main className="min-h-screen bg-black px-3 py-8 text-white sm:px-6 sm:py-16"><div className="mx-auto max-w-5xl">
    <header className="text-center"><p className="text-xs font-bold uppercase tracking-[0.35em] text-violet-400">{replay?"Battle Replay":"Live Battle"}</p><h1 className="mt-3 text-4xl font-black sm:text-7xl">PROLLY BATTLE TIME.</h1><p className="mt-4 text-zinc-400">{onChain.name}</p></header>
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:mt-10 sm:p-10">
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5"><p className="font-black text-violet-300">GENLAYER HAS ALREADY CHOSEN THE WINNERS.</p><p className="mt-2 text-sm leading-6 text-zinc-400">The story below is presentation only. It can randomize the order and wording of events, but it cannot decide who survives. The authoritative winner addresses came from the finalized GenLayer result.</p></div>
      <div className="mt-8 space-y-3">{visible.map((event,index)=><div key={index} className={`rounded-2xl border p-5 ${event.winner?"border-emerald-400/30 bg-emerald-400/5":"border-white/10 bg-black/20"}`}><p className="text-base leading-7 text-zinc-100"><span className="mr-3 text-2xl" aria-hidden="true">{event.emoji}</span>{(() => {
  const names = event.names ?? [];
  if (names.length === 1) {
    const name = names[0];
    const parts = event.text.split(name);
    return parts.map((part, i) => <span key={i}>{part}{i < parts.length - 1 && <strong className="font-black text-white">{name}</strong>}</span>);
  }
  if (names.length === 2) {
    const first = names[0];
    const second = names[1];
    const firstParts = event.text.split(first);
    return firstParts.map((part, i) => {
      const secondParts = part.split(second);
      return <span key={i}>{i > 0 && <strong className="font-black text-white">{first}</strong>}{secondParts.map((subpart, j) => <span key={j}>{subpart}{j < secondParts.length - 1 && <strong className="font-black text-white">{second}</strong>}</span>)}</span>;
    });
  }
  return event.text;
})()}</p>{event.winner&&<p className="mt-2 text-xs font-bold uppercase tracking-widest text-emerald-300">SURVIVED — ON-CHAIN WINNER</p>}</div>)}{visible.length===0&&<p className="text-center text-zinc-600">The Battle is about to begin...</p>}</div>
      {eventIndex>=story.length&&story.length>0&&<div className="mt-10 rounded-3xl border border-emerald-400/30 bg-emerald-400/5 p-6"><p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">Final survivors</p><div className="mt-4 space-y-2">{finalSurvivors.map((name,index)=><div key={index} className="rounded-xl bg-black/30 px-4 py-3 text-lg"><strong className="font-black">{name}</strong></div>)}</div><p className="mt-5 text-sm font-semibold text-emerald-300">Final survivor set exactly matches the GenLayer winner list.</p></div>}
      <div className="mt-10 rounded-2xl border border-white/10 p-5"><p className="text-xs uppercase tracking-widest text-zinc-500">Authoritative winners</p><div className="mt-4 space-y-2">{winnerAddresses.map((wallet,index)=><div key={wallet} className="flex justify-between rounded-xl bg-black/30 px-4 py-3"><span>{index+1}. <strong className="font-black">{usernameFor(wallet,participants,local)}</strong></span><span className="font-mono text-xs text-emerald-300">{wallet.slice(0,6)}...{wallet.slice(-4)}</span></div>)}</div></div>
    </section>
    <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href={`/prollys/${id}`} className="rounded-xl border border-white/10 px-5 py-3 font-semibold">Back to Prolly</Link>{!replay&&<Link href={`/prollys/${id}/battle?replay=1`} className="rounded-xl bg-white px-5 py-3 font-semibold text-black">Watch Replay</Link>}</div>
  </div></main>;
}
