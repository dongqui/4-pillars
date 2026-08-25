const CARD_CLASS = "bg-slate-50 border border-slate-200 rounded-[14px] px-5 py-4 mt-3";
const TIP_BADGE_CLASS =
  "flex-none text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-[9px] py-1 rounded-full mt-px";

export function NoteCard({ children, tip }: { children: React.ReactNode; tip?: boolean }) {
  return (
    <div className={`${CARD_CLASS} ${tip ? "flex gap-3 items-start" : ""}`}>
      {tip && <span className={TIP_BADGE_CLASS}>TIP</span>}
      <p className="text-sm text-slate-600 leading-[1.65] m-0 break-keep [text-wrap:pretty]">{children}</p>
    </div>
  );
}

/**
 * TIP 배지 + 제목 + 자유 블록. NoteCard 는 children 을 <p> 로 감싸므로
 * 칩 목록처럼 문단이 아닌 것을 담을 수 없다 — 껍데기만 공유한다.
 */
export function TipCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={CARD_CLASS}>
      <div className="flex gap-2.5 items-center mb-2.5">
        <span className={TIP_BADGE_CLASS}>TIP</span>
        <span className="text-[13px] font-bold text-slate-700">{label}</span>
      </div>
      {children}
    </div>
  );
}
