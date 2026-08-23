import Link from "next/link";
import type { PastMatchView } from "../_lib/to-past-match";

/**
 * 이미 본 궁합. 서버 컴포넌트로 둔다 — 목록은 링크 말고는 상호작용이 없어서
 * 클라이언트 JS 를 한 줄도 내려보낼 이유가 없다.
 *
 * 빈 목록은 이 컴포넌트가 아니라 부모가 판단한다: 목록이 비었는지 여부가 위쪽
 * 입력부를 펼칠지도 정하기 때문에, 두 곳이 같은 사실을 각자 세면 어긋난다.
 */
export function PastMatches({ items }: { items: PastMatchView[] }) {
  return (
    <section className="mt-11 border-t border-slate-200 pt-7">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-bold tracking-[-0.01em]">이미 본 궁합</h2>
        <span className="text-[12px] text-slate-400">{items.length}건</span>
      </div>
      {/* 사실이다: produceMatchSections 가 저장된 섹션만으로 끝나면 생성기를 아예
          부르지 않고, 이용권은 그 생성기를 감싼 자리에서만 나간다. */}
      <p className="mb-3 text-[13px] text-slate-400">
        한 번 본 궁합은 다시 열 때 이용권을 쓰지 않아요
      </p>

      <div className="flex flex-col gap-2">
        {items.map((m) => (
          <Link
            key={m.id}
            href={`/match/${m.id}`}
            className="flex items-center gap-3 rounded-[14px] border border-slate-200 bg-white px-[15px] py-[13px] transition-colors hover:border-slate-300"
          >
            <span className="flex flex-none items-center" aria-hidden>
              <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-accent-50 text-[13px] font-bold text-accent">
                {m.subjectInitial}
              </span>
              <span className="-ml-2.5 flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-slate-100 text-[13px] font-bold text-slate-500 shadow-[-2px_0_0_#fff]">
                {m.counterpartInitial}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-semibold tracking-[-0.015em] text-slate-900">
                {m.pair}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5">
                {m.relationLabel && (
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[12px] font-semibold text-slate-600">
                    {m.relationLabel}
                  </span>
                )}
                <span className="text-[12px] text-slate-400">{m.dateLabel}</span>
              </span>
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
              className="flex-none"
            >
              <path
                d="M6 4l4 4-4 4"
                stroke="#CBD5E1"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        ))}
      </div>
    </section>
  );
}
