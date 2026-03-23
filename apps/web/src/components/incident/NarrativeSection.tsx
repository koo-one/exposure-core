interface NarrativeSectionProps {
  number: string; // "01", "02", etc.
  title: string;
  children: React.ReactNode;
}

export function NarrativeSection({
  number,
  title,
  children,
}: NarrativeSectionProps) {
  return (
    <section className="py-16 md:py-24 border-b border-white/[0.06] last:border-b-0">
      <p className="text-xs text-white/25 font-mono tracking-widest mb-3">
        {number}
      </p>
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">
        {title}
      </h2>
      {children}
    </section>
  );
}
