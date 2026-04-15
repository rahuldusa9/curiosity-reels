import ReelCard from "@/components/ReelCard";
import { useEffect, useRef } from "react";

export default function FeedView({ cards, onRefresh, loading }) {
  const containerRef = useRef(null);

  // Force scroll to top whenever the cards data changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [cards]);

  return (
    <section ref={containerRef} className="h-dvh overflow-y-auto snap-y snap-mandatory relative pb-16">
      {cards.map((card, index) => (
        <ReelCard key={card.id || `${card.category}-${index}`} card={card} index={index} total={cards.length} />
      ))}
      <div className="snap-start h-dvh flex flex-col items-center justify-center text-white pb-20">
        <h3 className="text-2xl font-light mb-4">You&apos;ve reached the end</h3>
        <p className="text-white/60 mb-8 text-center max-w-xs px-4">Take a deep breath. Would you like to detach with a new set of facts?</p>
        <button 
          onClick={onRefresh}
          disabled={loading}
          className="px-6 py-3 bg-white text-black rounded-full text-sm uppercase tracking-widest font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Aligning..." : "Refresh Feed"}
        </button>
      </div>
    </section>
  );
}
