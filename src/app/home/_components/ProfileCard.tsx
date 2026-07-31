import Link from "next/link";
import type { ProfileCard as ProfileCardVM } from "../_lib/to-profile-card";

export function ProfileCard({ card }: { card: ProfileCardVM }) {
  const { isPaid } = card;
  const progress = Math.round((card.openedSections / card.totalSections) * 100);

  return (
    <div
      className={`relative overflow-hidden rounded-[20px] border bg-white ${
        isPaid
          ? "border-accent/25 shadow-[0_10px_26px_-18px_rgba(37,99,235,0.5)]"
          : "border-slate-200 shadow-[0_1px_3px_rgba(17,24,39,0.04)]"
      }`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${isPaid ? "bg-accent" : "bg-slate-200"}`} />

      <div className="flex flex-wrap items-center gap-[18px] px-6 py-[22px]">
        <div
          className={`ml-1.5 flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full text-[19px] font-bold ${
            isPaid ? "bg-accent-soft text-accent" : "bg-slate-100 text-slate-400"
          }`}
        >
          {card.initial}
        </div>

        <div className="min-w-[190px] flex-1">
          <span
            className={`mb-[5px] inline-flex items-center rounded-full px-[9px] py-[3px] text-xs font-bold ${
              isPaid
                ? "bg-accent-soft text-accent"
                : "border border-slate-200 bg-white text-slate-400"
            }`}
          >
            {isPaid ? "전체 리포트" : "무료 리포트"}
          </span>

          <div className="text-[19px] font-bold leading-[1.25] tracking-[-0.02em]">
            {card.name}
          </div>
          <div className="mt-[3px] text-sm text-slate-400">{card.birthLabel}</div>

          <div className="mt-3 flex max-w-[280px] items-center gap-2.5">
            <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${isPaid ? "bg-accent" : "bg-slate-300"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span
              className={`whitespace-nowrap text-[12.5px] font-semibold ${
                isPaid ? "text-accent" : "text-slate-400"
              }`}
            >
              {isPaid
                ? `${card.totalSections}개 섹션 전체`
                : `${card.totalSections}개 중 ${card.openedSections}개 열림`}
            </span>
          </div>
        </div>

        <div className="flex min-w-[150px] flex-col items-stretch gap-2">
          <Link
            href={card.reportHref}
            className={`whitespace-nowrap rounded-xl px-5 py-[11px] text-center text-[14.5px] font-semibold ${
              isPaid
                ? "bg-accent text-white hover:opacity-90"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {isPaid ? "리포트 보기" : "무료 리포트 보기"}
          </Link>
          {!isPaid && (
            // 결제가 아직 없으므로 리포트 안의 결제 CTA 로 넘긴다.
            <Link
              href={card.reportHref}
              className="whitespace-nowrap px-0.5 text-center text-[13.5px] font-semibold text-accent hover:underline"
            >
              전체 리포트 열기 · ₩9,900
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
