## Detox Reels (MVP)

Mobile-first social detox app with a reels-style vertical feed of short text cards and background music.

### Implemented in this first pass

- Full-screen vertical snap feed
- Preferences tab with category and music toggles
- Gemini-backed content endpoint with fallback cards
- Background audio bar with play/pause/next/volume
- Vercel-ready Next.js app structure

### Local setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
copy .env.example .env.local
```

Then set:

```bash
GEMINI_API_KEY=your_real_key
```

3. Add royalty-free tracks in `public/audio`.

Expected starter names:

- `calm-loop-01.mp3`
- `focus-loop-02.mp3`

4. Run dev server:

```bash
npm run dev
```

Open http://localhost:3000.

### API

- `POST /api/generate`
	- Body: `{ "categories": ["news", "science"] }`
	- Returns: `{ cards: [...] }`
	- If Gemini key is missing or request fails, fallback cards are returned.

### Build and deploy

```bash
npm run build
```

Deploy to Vercel and set `GEMINI_API_KEY` in Project Settings -> Environment Variables.

### Notes

- Keep music files licensed for your usage.
- On mobile browsers, autoplay may require one user interaction first.
"# curiosity-reels"  
