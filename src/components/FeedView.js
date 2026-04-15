import ReelCard from "@/components/ReelCard";

export default function FeedView({ cards }) {
  return (
    <section className="h-dvh overflow-y-auto snap-y snap-mandatory">
      {cards.map((card, index) => (
        <ReelCard key={card.id || `${card.category}-${index}`} card={card} index={index} total={cards.length} />
      ))}
    </section>
  );
}
