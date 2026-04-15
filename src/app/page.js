"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FeedView from "@/components/FeedView";
import MusicPlayer from "@/components/MusicPlayer";
import PreferencesPanel from "@/components/PreferencesPanel";
import { fallbackCards } from "@/data/fallbackCards";
import { musicCatalog } from "@/data/musicCatalog";
import {
  defaultPreferences,
  loadPreferences,
  savePreferences,
} from "@/lib/preferences";

export default function Home() {
  const [cards, setCards] = useState(fallbackCards);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState("fallback");
  const [feedError, setFeedError] = useState("");
  const [activeTab, setActiveTab] = useState("feed");
  const [preferences, setPreferences] = useState(defaultPreferences);

  useEffect(() => {
    const stored = loadPreferences();
    setPreferences(stored);
  }, []);

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setFeedError("");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: preferences.categories }),
      });

      if (!response.ok) throw new Error("Failed to fetch feed");
      const data = await response.json();

      setSource(data?.source || "unknown");
      if (data?.error) {
        setFeedError(String(data.error));
      }

      if (Array.isArray(data.cards) && data.cards.length) {
        setCards(data.cards);
      }
    } catch {
      setCards(fallbackCards);
      setSource("fallback-error");
      setFeedError("Network or API error while loading generated cards");
    } finally {
      setLoading(false);
    }
  }, [preferences.categories]);

  useEffect(() => {
    void fetchCards();
  }, [fetchCards]);

  const fallbackTracks = useMemo(() => musicCatalog, []);

  useEffect(() => {
    async function loadTracks() {
      try {
        const response = await fetch("/api/music", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load music");

        const data = await response.json();
        const dynamicTracks = Array.isArray(data?.tracks) ? data.tracks : [];

        if (dynamicTracks.length) {
          setTracks(dynamicTracks);
          return;
        }
      } catch {
        // Fallback to static catalog below.
      }

      setTracks(fallbackTracks);
    }

    void loadTracks();
  }, [fallbackTracks]);

  return (
    <div className="min-h-dvh bg-layer text-white">
      <header className="fixed top-0 left-0 right-0 z-20 px-4 pt-3">
        <div className="mx-auto max-w-xl rounded-2xl border border-white/15 bg-black/35 backdrop-blur-md p-2 flex items-center justify-between">
          <h1 className="px-2 text-sm tracking-[0.2em] uppercase text-white/85">
            Curiosity Reels
          </h1>
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/70">
            {loading ? "loading" : source}
          </p>
          <nav className="flex gap-2">
            <button
              className={`tab-btn ${activeTab === "feed" ? "tab-btn-active" : "tab-btn-muted"}`}
              onClick={() => setActiveTab("feed")}
              type="button"
            >
              Discover
            </button>
            <button
              className={`tab-btn ${activeTab === "preferences" ? "tab-btn-active" : "tab-btn-muted"}`}
              onClick={() => setActiveTab("preferences")}
              type="button"
            >
              Studio
            </button>
          </nav>
        </div>
      </header>

      {activeTab === "feed" ? (
        <>
          <FeedView cards={cards} />
          {feedError ? (
            <p className="fixed top-16 left-1/2 -translate-x-1/2 z-20 max-w-[90vw] rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1 text-xs text-amber-100">
              {feedError}
            </p>
          ) : null}
        </>
      ) : (
        <PreferencesPanel
          preferences={preferences}
          onChange={setPreferences}
          onRegenerate={fetchCards}
          loading={loading}
        />
      )}

      {preferences.musicEnabled ? (
        <MusicPlayer
          tracks={tracks}
          preferences={preferences}
          onPreferencesChange={setPreferences}
        />
      ) : null}
    </div>
  );
}
