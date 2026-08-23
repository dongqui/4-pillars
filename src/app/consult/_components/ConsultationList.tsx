import Link from "next/link";
import type { ConsultationEntry } from "../_lib/to-list-entry";

/**
 * 지난 상담 줄 목록. 빈 목록은 여기까지 오지 않는다 — 빈 상태는 시작 버튼을
 * 들고 있어야 해서 ConsultBoard 가 그린다.
 *
 * 시안의 줄은 제목 · 날짜 · 미리보기 셋인데 남은 턴(progress)을 하나 더 얹었다.
 * 이어 갈 수 있는 상담인지 끝난 상담인지가 목록에서 보이지 않으면 열어 봐야만
 * 알 수 있다.
 */
export function ConsultationList({ entries }: { entries: ConsultationEntry[] }) {
  return (
    <ul className="flex-none pb-5 pt-2">
      {entries.map((e) => (
        <li key={e.id}>
          <Link
            href={`/consult/${e.id}`}
            className="block border-b border-slate-100 px-[clamp(16px,4vw,22px)] py-[15px] hover:bg-slate-50 min-[900px]:px-[26px]"
          >
            <div className="mb-[5px] flex items-baseline gap-2.5">
              <span className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-[-0.025em] text-slate-900">
                {e.title}
              </span>
              <span className="flex-none text-[12px] tabular-nums text-slate-400">{e.when}</span>
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="min-w-0 flex-1 truncate text-[13.5px] leading-[1.5] text-slate-500">
                {e.preview}
              </span>
              <span className="flex-none text-[12px] font-semibold tabular-nums text-slate-400">
                {e.progress}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
