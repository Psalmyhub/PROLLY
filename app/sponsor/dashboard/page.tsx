"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";
import { getRole } from "@/lib/role-store";
import { PROLLY_CONTRACT_OWNER } from "@/lib/genlayer";
import { loadSponsorCampaigns, removeSponsorCampaign, saveSponsorCampaigns, type SponsorCampaign, type SponsorParticipant } from "@/lib/sponsor-store";

function makeToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}
function toTimestamp(value: string) { const t = new Date(value).getTime(); return Number.isFinite(t) ? t : undefined; }
function formatTime(ts?: number) { return ts ? new Date(ts).toLocaleString() : "Not scheduled"; }

export default function SponsorDashboard() {
  const { address } = useAccount();
  const [campaigns,setCampaigns]=useState<SponsorCampaign[]>([]);
  const [type,setType]=useState<"link"|"manual">("link");
  const [topic,setTopic]=useState("");
  const [description,setDescription]=useState("");
  const [winnerCount,setWinnerCount]=useState("1");
  const [maxParticipants,setMaxParticipants]=useState("100");
  const [startAt,setStartAt]=useState("");
  const [accessMinutes,setAccessMinutes]=useState("30");
  const [community,setCommunity]=useState("");
  const [participants,setParticipants]=useState("");
  const [message,setMessage]=useState("");

  const approved=!!address && ["sponsor","admin"].includes(getRole(address,PROLLY_CONTRACT_OWNER));
  useEffect(()=>{ setCampaigns(address?loadSponsorCampaigns(address):[]); },[address]);

  function createCampaign() {
    if(!address) return setMessage("Connect your sponsor wallet first.");
    const winners=Number(winnerCount), max=Number(maxParticipants);
    if(!topic.trim()||!description.trim()) return setMessage("Topic and description are required.");
    if(!Number.isInteger(winners)||winners<1||winners>max) return setMessage("Winner count must be between 1 and maximum participants.");
    if(!Number.isInteger(max)||max<1) return setMessage("Maximum participants must be at least 1.");
    const start=type==="link"?toTimestamp(startAt):Date.now();
    if(type==="link" && !start) return setMessage("Choose a start time for a Link Prolly.");
    const minutes=Math.max(0,Math.min(30,Number(accessMinutes)||0));
    const selected: SponsorParticipant[] = type==="manual"
      ? participants.split(/[\n,]+/).map(v=>v.trim()).filter(Boolean).map(v=>({username:v.startsWith("@")?v.slice(1):v,walletAddress:""}))
      : [];
    if(type==="manual" && selected.length!==max) return setMessage("Manual Prolly participant count must match Maximum Participants.");
    const campaign: SponsorCampaign={
      id:`sponsor-${Date.now()}`, ownerWallet:address, topic:topic.trim(), description:description.trim(),
      type,winnerCount:winners,maxParticipants:max,participantsJoined:type==="manual"?selected.length:0,
      selectedParticipants:selected,startAt:start,accessOpensAt:type==="link"?(start!-minutes*60000):undefined,
      accessToken:type==="link"?makeToken():undefined,communityLinks:community.split(/\n+/).map(v=>v.trim()).filter(Boolean).map(v=>({label:v.split("|")[0]?.trim()||"Community",url:v.split("|").slice(1).join("|").trim()})).filter(v=>v.url),
      createdAt:Date.now(),status:"draft"
    };
    const next=[campaign,...campaigns]; saveSponsorCampaigns(address,next); setCampaigns(next);
    setTopic("");setDescription("");setWinnerCount("1");setMaxParticipants("100");setStartAt("");setParticipants("");setCommunity("");
    setMessage("Sponsor Prolly brief saved locally. On-chain sponsor creation will be aligned later with the contract audit.");
  }
  function publish(id:string){ if(!address)return; const next=campaigns.map(c=>c.id===id?{...c,status:"published" as const}:c);saveSponsorCampaigns(address,next);setCampaigns(next);setMessage("Published in the sponsor workspace. This prototype does not yet create the on-chain Sponsor Prolly.");}
  function remove(id:string){if(!address)return;removeSponsorCampaign(address,id);setCampaigns(campaigns.filter(c=>c.id!==id));}

  if(!approved)return <main className="min-h-screen bg-zinc-950 p-8 text-white"><div className="mx-auto max-w-2xl pt-20"><p className="text-sm uppercase tracking-widest text-violet-400">Sponsor Dashboard</p><h1 className="mt-4 text-3xl font-bold">Sponsor access required</h1><p className="mt-4 text-zinc-400">Only an approved sponsor wallet can manage Sponsor Prollys.</p><Link href="/sponsor" className="mt-6 inline-block rounded-full bg-violet-500 px-6 py-3 font-semibold">Sponsor Application</Link></div></main>;

  return <main className="min-h-screen bg-zinc-950 text-white"><nav className="border-b border-zinc-800"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6"><Link href="/" className="text-2xl font-bold">PROLLY<span className="text-violet-400">.</span></Link><div className="flex gap-3"><WorkspaceSwitcher/><Link href="/prollys" className="rounded-full border border-zinc-700 px-5 py-2 text-sm">Explore</Link></div></div></nav>
  <section className="mx-auto max-w-7xl px-6 py-14"><p className="text-sm uppercase tracking-widest text-violet-400">Sponsor Workspace</p><h1 className="mt-4 text-4xl font-bold">Create a Sponsor Prolly.</h1><p className="mt-4 max-w-3xl text-zinc-400">Sponsors have exactly two formats: Link Prolly and Manual Prolly. Both are free. GenLayer remains the future authoritative participant and winner layer.</p>
  <div className="mt-10 grid gap-8 lg:grid-cols-2"><section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-7"><h2 className="text-2xl font-semibold">Prolly setup</h2><div className="mt-5 grid grid-cols-2 gap-3">{(["link","manual"] as const).map(v=><button key={v} onClick={()=>setType(v)} className={`rounded-2xl border p-4 text-left ${type===v?"border-violet-500 bg-violet-500/10":"border-zinc-700"}`}><b>{v==="link"?"Link Prolly":"Manual Prolly"}</b><p className="mt-1 text-xs text-zinc-500">{v==="link"?"Private sponsor link; users receive it from the sponsor.":"Sponsor supplies the participant list."}</p></button>)}</div>
  <label className="mt-6 block text-sm">Topic</label><input value={topic} onChange={e=>setTopic(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"/>
  <label className="mt-5 block text-sm">Description</label><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"/>
  <div className="mt-5 grid gap-4 sm:grid-cols-2"><div><label className="text-sm">Winner count</label><input type="number" min="1" value={winnerCount} onChange={e=>setWinnerCount(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"/></div><div><label className="text-sm">Maximum participants</label><input type="number" min="1" value={maxParticipants} onChange={e=>setMaxParticipants(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"/></div></div>
  {type==="link"?<><label className="mt-5 block text-sm">Start time</label><input type="datetime-local" value={startAt} onChange={e=>setStartAt(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"/><label className="mt-5 block text-sm">Access opens before start <span className="text-zinc-500">(0–30 minutes)</span></label><input type="number" min="0" max="30" value={accessMinutes} onChange={e=>setAccessMinutes(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"/><label className="mt-5 block text-sm">Community/contact links <span className="text-zinc-500">(one per line: Telegram | URL)</span></label><textarea value={community} onChange={e=>setCommunity(e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"/></>:<><label className="mt-5 block text-sm">Selected participants <span className="text-zinc-500">(one username or wallet per line)</span></label><textarea value={participants} onChange={e=>setParticipants(e.target.value)} rows={6} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"/></>}
  <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"><b className="text-emerald-300">No fees</b><p className="mt-1 text-xs text-zinc-500">Sponsor and participants pay 0 GEN for Sponsor Prollys.</p></div>
  <button onClick={createCampaign} className="mt-6 w-full rounded-full bg-violet-500 py-3 font-semibold">Save Sponsor Prolly</button>{message&&<p className="mt-4 text-sm text-zinc-400">{message}</p>}</section>
  <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-7"><h2 className="text-2xl font-semibold">Your Sponsor Prollys</h2>{campaigns.length===0?<p className="mt-6 text-zinc-500">No Sponsor Prollys yet.</p>:<div className="mt-6 space-y-4">{campaigns.map(c=><article key={c.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5"><div className="flex justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-violet-400">{c.type==="link"?"Link Prolly":"Manual Prolly"}</p><h3 className="mt-2 text-xl font-bold">{c.topic}</h3></div><span className="text-xs text-zinc-500">{c.status}</span></div><p className="mt-3 text-sm text-zinc-400">{c.description}</p><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><span>Winners: <b>{c.winnerCount}</b></span><span>Maximum: <b>{c.maxParticipants}</b></span>{c.type==="link"?<><span>Joined: <b>{c.participantsJoined}/{c.maxParticipants}</b></span><span>Start: <b>{formatTime(c.startAt)}</b></span><span>Access opens: <b>{formatTime(c.accessOpensAt)}</b></span></>:<span>Participants: <b>{c.selectedParticipants.length}/{c.maxParticipants}</b></span>}</div>{c.type==="link"&&c.accessToken&&<div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4"><b className="text-cyan-300">Private sponsor access link</b><p className="mt-2 break-all text-xs text-zinc-400">{typeof window!=="undefined"?window.location.origin:""}/sponsor/campaign/{c.accessToken}</p><p className="mt-2 text-xs text-zinc-500">Keep this link private. It is intentionally not shown on Explore.</p><button onClick={()=>{const link=window.location.origin+"/sponsor/campaign/"+c.accessToken;void navigator.clipboard?.writeText(link);setMessage("Private access link copied.");}} className="mt-3 rounded-full bg-cyan-400 px-4 py-2 text-xs font-semibold text-black">Copy Access Link</button></div>}{c.type==="link"&&c.communityLinks.length>0&&<div className="mt-4 text-xs text-zinc-500">Community: {c.communityLinks.map((l,i)=><a key={i} href={l.url} target="_blank" rel="noreferrer" className="ml-2 text-cyan-300">{l.label}</a>)}</div>}{c.type==="manual"&&<div className="mt-4 space-y-2">{c.selectedParticipants.map((p,i)=><div key={i} className="rounded-xl bg-zinc-900 px-3 py-2 text-sm">{p.username||p.walletAddress}</div>)}</div>}<div className="mt-5 flex gap-3">{c.status==="draft"&&<button onClick={()=>publish(c.id)} className="flex-1 rounded-full bg-emerald-400 py-2 text-sm font-semibold text-black">Publish Prolly</button>}<button onClick={()=>remove(c.id)} className="rounded-full border border-red-500/30 px-4 py-2 text-sm text-red-300">Delete</button></div></article>)}</div>}</section></div></section></main>;
}
