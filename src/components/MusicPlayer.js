"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function MusicPlayer({ tracks, preferences, onPreferencesChange }) {
  const audioRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const safeIndex = useMemo(() => {
    if (!tracks.length) return 0;
    return index % tracks.length;
  }, [index, tracks.length]);

  const activeTrack = useMemo(() => tracks[safeIndex] || null, [tracks, safeIndex]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = preferences.volume;
  }, [preferences.volume]);

  useEffect(() => {
    if (!audioRef.current || !activeTrack) return;
    audioRef.current.src = activeTrack.src;
    audioRef.current.load();

    if (preferences.autoplayMusic && preferences.musicEnabled) {
      void audioRef.current.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    }
  }, [activeTrack, preferences.autoplayMusic, preferences.musicEnabled]);

  function togglePlay() {
    if (!audioRef.current || !activeTrack) return;

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }

    void audioRef.current.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }

  function nextTrack() {
    if (!tracks.length) return;
    setIndex((prev) => (prev + 1) % tracks.length);
  }

  function updateVolume(event) {
    const volume = Number(event.target.value);
    onPreferencesChange({ ...preferences, volume });
  }

  return (
    <section className="music-bar fixed bottom-0 left-0 right-0 px-4 py-3 z-20">
      <audio
        ref={audioRef}
        onEnded={nextTrack}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />

      <div className="mx-auto max-w-xl rounded-2xl border border-white/20 bg-black/45 backdrop-blur-md p-4 text-white">
        <p className="text-xs uppercase tracking-[0.18em] text-white/65">Background audio</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {activeTrack ? activeTrack.title : "No track"}
            </p>
            <p className="truncate text-xs text-white/70">
              {activeTrack ? activeTrack.artist : "Add tracks in /public/audio"}
            </p>
            <p className="truncate text-xs text-white/55">
              {tracks.length ? `${tracks.length} tracks loaded` : "No tracks found"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button suppressHydrationWarning className="action-btn" onClick={togglePlay} type="button">
              {playing ? "Pause" : "Play"}
            </button>
            <button suppressHydrationWarning className="action-btn" onClick={nextTrack} type="button">
              Next
            </button>
          </div>
        </div>

        <label className="mt-3 flex items-center gap-3 text-xs text-white/80">
          Volume
          <input
            className="w-full"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={preferences.volume}
            onChange={updateVolume}
          />
        </label>
      </div>
    </section>
  );
}
