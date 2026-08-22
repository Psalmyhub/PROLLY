"use client";

import { useEffect, useState } from "react";
import {
  loadProfile,
  saveProfile,
  type UserProfile,
} from "@/lib/profile-store";

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = loadProfile();

    if (saved) {
      setProfile(saved);
      setUsername(saved.username);
    }
  }, []);

  function handleSave() {
    const cleanUsername = username.trim().replace(/^@/, "");

    if (!cleanUsername) {
      setMessage("Please choose a username.");
      return;
    }

    if (cleanUsername.length < 3) {
      setMessage("Username must be at least 3 characters.");
      return;
    }

    if (cleanUsername.length > 20) {
      setMessage("Username cannot exceed 20 characters.");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setMessage(
        "Username can only contain letters, numbers, and underscores.",
      );
      return;
    }

    const now = Date.now();

    const updatedProfile: UserProfile = {
      username: cleanUsername,
      createdAt: profile?.createdAt ?? now,
      updatedAt: now,
    };

    saveProfile(updatedProfile);
    setProfile(updatedProfile);
    setUsername(cleanUsername);
    setMessage("Profile saved successfully.");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <a href="/" className="text-2xl font-bold tracking-tight">
            PROLLY<span className="text-violet-400">.</span>
          </a>

          <a
            href="/prollys"
            className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium hover:bg-zinc-800"
          >
            Explore
          </a>
        </div>
      </nav>

      <section className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
          Profile
        </p>

        <h1 className="mt-4 text-4xl font-bold">
          Your Prolly identity.
        </h1>

        <p className="mt-5 text-lg leading-8 text-zinc-400">
          Choose the username that will appear when you participate
          in a Prolly.
        </p>

        <div className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8">
          <label className="text-sm font-medium text-zinc-300">
            Username
          </label>

          <div className="mt-2 flex items-center rounded-xl border border-zinc-700 bg-zinc-950 px-4">
            <span className="text-zinc-500">@</span>

            <input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setMessage("");
              }}
              placeholder="username"
              maxLength={20}
              className="w-full bg-transparent px-2 py-3 outline-none"
            />
          </div>

          <p className="mt-3 text-sm text-zinc-500">
            3–20 characters. Letters, numbers, and underscores only.
          </p>

          <button
            onClick={handleSave}
            className="mt-7 w-full rounded-full bg-violet-500 py-3 font-semibold hover:bg-violet-400"
          >
            {profile ? "Update Username" : "Create Profile"}
          </button>

          {message && (
            <p className="mt-4 text-center text-sm text-zinc-400">
              {message}
            </p>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6">
          <p className="font-semibold text-violet-300">
            Prototype profile
          </p>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Your username is currently stored locally in this browser.
            Wallet authentication and email verification will be added
            later.
          </p>
        </div>
      </section>
    </main>
  );
}
