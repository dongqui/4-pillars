export function NoteCard({ children, tip }: { children: React.ReactNode; tip?: boolean }) {
  return (
    <div className={`bg-slate-50 border border-slate-200 rounded-[14px] px-5 py-4 mt-3 ${tip ? "flex gap-3 items-start" : ""}`}>
      {tip && (
        <span className="flex-none text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-[9px] py-1 rounded-full mt-px">TIP</span>
      )}
      <p className="text-sm text-slate-600 leading-[1.65] m-0 break-keep [text-wrap:pretty]">{children}</p>
    </div>
  );
}
