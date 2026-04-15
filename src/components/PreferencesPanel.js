"use client";

import { preferenceOptions } from "@/lib/preferences";

export default function PreferencesPanel({ preferences, onChange, onRegenerate, loading }) {
  function toggleCategory(category) {
    const exists = preferences.categories.includes(category);
    const categories = exists
      ? preferences.categories.filter((item) => item !== category)
      : [...preferences.categories, category];

    if (!categories.length) return;
    onChange({ ...preferences, categories });
  }

  function applyPreset(type) {
    const presetMap = {
      chill: ["mindset", "stories", "health"],
      sharp: ["science", "technology", "productivity"],
      explorer: ["history", "news", "science"],
    };

    onChange({
      ...preferences,
      categories: presetMap[type] || preferences.categories,
    });
  }

  return (
    <aside className="panel p-4 mt-3 mb-28 mx-4 rounded-2xl text-white max-w-xl">
      <h2 className="text-lg font-semibold">Your Reel Studio</h2>
      <p className="mt-1 text-sm text-white/75">
        Shape the feed vibe, then refresh for a fresh set of scrollable sparks.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <button className="chip chip-muted" onClick={() => applyPreset("chill")} type="button">
          Chill mode
        </button>
        <button className="chip chip-muted" onClick={() => applyPreset("sharp")} type="button">
          Sharp mode
        </button>
        <button className="chip chip-muted" onClick={() => applyPreset("explorer")} type="button">
          Explorer
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {preferenceOptions.map((item) => {
          const active = preferences.categories.includes(item);
          return (
            <button
              className={`chip ${active ? "chip-active" : "chip-muted"}`}
              key={item}
              onClick={() => toggleCategory(item)}
              type="button"
            >
              {item}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <label className="flex items-center justify-between gap-3">
          Music enabled
          <input
            type="checkbox"
            checked={preferences.musicEnabled}
            onChange={(event) =>
              onChange({ ...preferences, musicEnabled: event.target.checked })
            }
          />
        </label>

        <label className="flex items-center justify-between gap-3">
          Autoplay after user gesture
          <input
            type="checkbox"
            checked={preferences.autoplayMusic}
            onChange={(event) =>
              onChange({ ...preferences, autoplayMusic: event.target.checked })
            }
          />
        </label>
      </div>

      <button className="primary-btn mt-5" onClick={onRegenerate} type="button" disabled={loading}>
        {loading ? "Cooking fresh reels..." : "Generate new drop"}
      </button>
    </aside>
  );
}
