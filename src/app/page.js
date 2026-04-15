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
        const trace = data?.requestId ? ` (request: ${data.requestId})` : "";
        setFeedError(`${String(data.error)}${trace}`);
      }

      if (Array.isArray(data.cards) && data.cards.length) {
        setCards(data.cards);
      }
    } catch (err) {
      // If Vercel entirely rejects the request (e.g. 504), shuffle fallback so UI still feels alive
      const shuffled = [...fallbackCards].sort(() => 0.5 - Math.random()).slice(0, 8);
      setCards(shuffled.map((c, i) => ({ ...c, id: `fallback-err-${Date.now()}-${i}` })));
      setSource("fallback-error");
      setFeedError(err.message || "Network or API error while loading generated cards");
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
          <h1 className="px-2 text-xs tracking-[0.2em] font-medium uppercase text-white/90">
            Social Detox
          </h1>
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/60">
            {loading ? "Aligning..." : source === "simulated-offline" ? "Offline mode" : "Connected"}
          </p>
          <nav className="flex gap-1.5 bg-black/40 rounded-full p-1 border border-white/5">
            <button
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium tracking-[0.08em] uppercase transition-all ${
                activeTab === "feed" ? "bg-white text-black shadow-sm" : "text-white/60 hover:text-white"
              }`}
              onClick={() => setActiveTab("feed")}
              type="button"
            >
              Feed
            </button>
            <button
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium tracking-[0.08em] uppercase transition-all ${
                activeTab === "preferences" ? "bg-white text-black shadow-sm" : "text-white/60 hover:text-white"
              }`}
              onClick={() => setActiveTab("preferences")}
              type="button"
            >
              Focus
            </button>
          </nav>
        </div>
      </header>

      {activeTab === "feed" ? (
        <>
          <FeedView cards={cards} onRefresh={fetchCards} loading={loading} />
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
