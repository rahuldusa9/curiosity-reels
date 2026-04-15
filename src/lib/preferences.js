export const defaultPreferences = {
  categories: ["news", "science", "mindset"],
  autoplayMusic: false,
  musicEnabled: true,
  volume: 0.35,
};

export const preferenceOptions = [
  "news",
  "science",
  "mindset",
  "stories",
  "history",
  "health",
  "technology",
  "productivity",
];

const KEY = "detox-preferences";

export function loadPreferences() {
  if (typeof window === "undefined") return defaultPreferences;

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultPreferences;

    const parsed = JSON.parse(raw);
    return {
      ...defaultPreferences,
      ...parsed,
      categories: Array.isArray(parsed?.categories)
        ? parsed.categories
        : defaultPreferences.categories,
    };
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(preferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(preferences));
}
