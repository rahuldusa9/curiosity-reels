export default function ReelCard({ card, index, total }) {
  const vibes = ["wow", "smart", "story", "mind", "future"];
  const vibe = vibes[index % vibes.length];

  return (
    <article className="reel-card h-dvh snap-start px-6 pt-20 pb-24 flex flex-col justify-between">
      <div className="w-full max-w-xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.22em] text-white/70">
            {card.category}
          </p>
          <p className="vibe-pill">{vibe} pick</p>
        </div>

        <div className="mt-4 h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-[#ffd166] via-[#42d6a4] to-[#0ea5e9]"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>

        <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-white/55">
          Swipe to detach
        </p>
        <h2 className="mt-4 text-3xl leading-tight font-semibold text-white text-balance drop-shadow-md">
          {card.text}
        </h2>
        <p className="mt-5 text-[1.05rem] leading-relaxed text-white/90 font-light">{card.subtext}</p>

        <div className="mt-8 flex items-center justify-start gap-3">
          <span className="reaction-chip hover:bg-white/20 transition cursor-pointer">Grounding</span>
          <span className="reaction-chip hover:bg-white/20 transition cursor-pointer">Breathe</span>
        </div>
      </div>

      <div className="w-full max-w-xl mx-auto flex items-center justify-between text-white/50 text-xs tracking-wider">
        <p>Curated Detachment</p>
        <p className="font-mono">
          {index + 1} / {total}
        </p>
      </div>
    </article>
  );
}
