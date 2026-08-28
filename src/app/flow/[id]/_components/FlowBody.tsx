import Link from "next/link";
import type { FlowMonth } from "@/app/api/flows/_lib/pivots";
import {
  type ClosingContent,
  type FlowSectionKey,
  type ItemsContent,
  type MonthsContent,
  type OverviewContent,
  type PivotsContent,
  type ProseContent,
} from "@/app/api/flows/_lib/sections";
import { InfoCard } from "@/app/report/_components/InfoCard";
import { NoteCard } from "@/app/report/_components/NoteCard";
import { monthLabel } from "../_lib/current-month";
import type { FlowSectionView } from "../_lib/to-flow-view";
import { MonthTimeline } from "./MonthTimeline";

const SECTION = "mt-[72px]";

/**
 * 번호·카테고리·제목을 그리는 순수 표시부.
 *
 * @/app/report/_components/SectionHeading 를 공유해 쓰지 않고 여기 따로 둔다 —
 * 이 브랜치가 그 파일을 건드리지 않아야 main 이 그 자리에서 SectionHeading 을
 * 레지스트리 기반 컴포넌트로 재사용한 변경(5dc26fd, 원래 컴포넌트를
 * SectionHeadingRaw 로 뽑아냄)이 병합 때 충돌 없이 그대로 들어온다. 지금 이
 * 파일을 고쳐 그 이름을 미리 만들어 두면 diff 가 main 과 같은 줄을 서로 다르게
 * 바꾸게 되어 오히려 병합 충돌을 만든다(직접 확인함, `git merge-tree` 결과 참고).
 */
function Heading({ no, category, title }: { no: string; category: string; title: string }) {
  return (
    <>
      <div className="text-xs font-bold tracking-[0.08em] text-slate-400 mb-2">{no} · {category}</div>
      <h2 className="text-[clamp(20px,4vw,24px)] font-bold tracking-[-0.02em] m-0 mb-5">{title}</h2>
    </>
  );
}

/**
 * 01~09 표시 메타. FlowSectionKey 로 색인해 전수 커버리지를 강제한다 —
 * 레지스트리에 키가 하나 늘면 이 객체가 같이 늘지 않는 한 컴파일이 깨진다.
 */
const SECTION_META: Record<FlowSectionKey, { no: string; category: string }> = {
  overview: { no: "01", category: "한 해의 흐름" },
  rising: { no: "02", category: "힘이 실리는 것" },
  straining: { no: "03", category: "부담되는 것" },
  work: { no: "04", category: "일과 선택" },
  relating: { no: "05", category: "관계" },
  money: { no: "06", category: "돈과 현실" },
  months: { no: "07", category: "월별 흐름" },
  // pivots 의 category 는 아래 pivots 케이스에서 flowYear 를 담아 동적으로 조립한다
  pivots: { no: "08", category: "올해의 변곡점" },
  closing: { no: "09", category: "이 해의 포인트" },
};

/**
 * 서술 9섹션 → 화면. interpretation 은 부분 생성 결과일 수 있어
 * (FlowGenerationError.partial) 각 섹션은 자기 키가 없으면 통째로 건너뛴다.
 *
 * 달 이름·기간·변곡점 강조는 전부 화면이 붙인다 — LLM 은 순번만 안다.
 * 04 끝의 /consult, 05 끝의 /match 링크도 같은 이유로 화면이 붙인다(§32).
 */
export function FlowBody({
  sections,
  months,
  currentIndex,
  profileId,
  flowYear,
}: {
  sections: FlowSectionView[];
  months: FlowMonth[];
  currentIndex: number | null;
  profileId: string;
  flowYear: number;
}) {
  return (
    <>
      {sections.map((view) => {
        const meta = SECTION_META[view.key];

        if (view.key === "overview") {
          const c = view.content as OverviewContent;
          return (
            <section key={view.key} className={SECTION}>
              <Heading no={meta.no} category={meta.category} title={c.title} />
              <NoteCard>{c.body}</NoteCard>
            </section>
          );
        }

        if (view.key === "months") {
          const c = view.content as MonthsContent;
          return (
            <section key={view.key} className={SECTION}>
              <Heading no={meta.no} category={meta.category} title="이렇게 흘러가요" />
              <NoteCard>{c.lead}</NoteCard>
              <MonthTimeline content={c} months={months} currentIndex={currentIndex} />
            </section>
          );
        }

        if (view.key === "pivots") {
          const c = view.content as PivotsContent;
          const metaOf = new Map(months.map((m) => [m.index, m]));
          return (
            <section key={view.key} className={SECTION}>
              <Heading
                no={meta.no}
                category={`${flowYear}년의 변곡점`}
                title="흐름이 크게 달라지는 시기"
              />
              <NoteCard>{c.lead}</NoteCard>
              {/* 변곡점이 없으면 lead 하나로 끝난다 — 없는 변화를 만들지 않는다(§21) */}
              {c.pivots.length > 0 && (
                <div className="mt-3 flex flex-col gap-3">
                  {c.pivots.map((p) => {
                    const m = metaOf.get(p.monthIndex);
                    return (
                      <InfoCard
                        key={p.monthIndex}
                        label={m ? `${monthLabel(m)} 무렵` : `${p.monthIndex}번째 달`}
                      >
                        <span className="mb-1 block font-semibold text-slate-800">{p.title}</span>
                        {p.body}
                      </InfoCard>
                    );
                  })}
                </div>
              )}
            </section>
          );
        }

        if (view.key === "closing") {
          const c = view.content as ClosingContent;
          return (
            <section key={view.key} className={SECTION}>
              <Heading no={meta.no} category={meta.category} title="기억할 것" />
              <NoteCard>{c.lead}</NoteCard>
              <div className="mt-3 flex flex-col gap-3">
                {c.items.map((item) => (
                  <InfoCard key={item.title} label={item.title}>
                    {item.body}
                  </InfoCard>
                ))}
              </div>
              <p className="mt-6 text-center text-[15px] font-semibold leading-[1.6] tracking-[-0.02em] text-slate-800">
                {c.closing}
              </p>
            </section>
          );
        }

        if (view.key === "rising" || view.key === "straining") {
          const c = view.content as ItemsContent;
          return (
            <section key={view.key} className={SECTION}>
              <Heading no={meta.no} category={meta.category} title={c.lead} />
              <div className="mt-3 flex flex-col gap-3">
                {c.items.map((item) => (
                  <InfoCard key={item.title} label={item.title}>
                    {item.body}
                  </InfoCard>
                ))}
              </div>
            </section>
          );
        }

        const c = view.content as ProseContent;
        return (
          <section key={view.key} className={SECTION}>
            <Heading no={meta.no} category={meta.category} title={c.lead} />
            <div className="mt-3">
              <InfoCard label={meta.category}>{c.body}</InfoCard>
            </div>
            {view.key === "work" && (
              <p className="mt-5 text-[13.5px] text-slate-500">
                {flowYear}년 고민 중인 선택이 있다면{" "}
                <Link
                  href={`/consult?profile=${profileId}`}
                  className="font-semibold text-slate-700 underline underline-offset-2"
                >
                  고민상담
                </Link>
                에서 더 구체적으로 이야기해볼 수 있어요.
              </p>
            )}
            {view.key === "relating" && (
              <p className="mt-5 text-[13.5px] text-slate-500">
                마음에 걸리는 사람이 있다면{" "}
                <Link
                  href="/match"
                  className="font-semibold text-slate-700 underline underline-offset-2"
                >
                  궁합
                </Link>
                에서 두 사람의 관계를 더 자세히 볼 수 있어요.
              </p>
            )}
          </section>
        );
      })}
    </>
  );
}
