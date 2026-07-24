export function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-200 rounded-[14px] px-5 py-[18px]">
      <div className="text-[13px] font-bold text-slate-400 mb-1.5">{label}</div>
      <p className="text-sm text-slate-700 leading-[1.65] m-0 break-keep [text-wrap:pretty]">{children}</p>
    </div>
  );
}
