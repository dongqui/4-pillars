export function SectionHeading({ no, category, title }: { no: string; category: string; title: string }) {
  return (
    <>
      <div className="text-xs font-bold tracking-[0.08em] text-slate-400 mb-2">{no} · {category}</div>
      <h2 className="text-[clamp(20px,4vw,24px)] font-bold tracking-[-0.02em] m-0 mb-5">{title}</h2>
    </>
  );
}
