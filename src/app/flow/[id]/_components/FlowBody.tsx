import Link from "next/link";
import type { FlowMonth } from "@/app/api/flows/_lib/pivots";
import {
  FLOW_SECTION_KEYS,
  type ClosingContent,
  type FlowSectionKey,
  type ItemsContent,
  type MonthsContent,
  type OverviewContent,
  type ProseContent,
} from "@/app/api/flows/_lib/sections";
import { InfoCard } from "@/app/report/_components/InfoCard";
import { NoteCard } from "@/app/report/_components/NoteCard";
import { SectionHeadingRaw } from "@/app/report/_components/SectionHeading";
import type { FlowSectionView } from "../_lib/to-flow-view";
import { MonthTimeline } from "./MonthTimeline";

const SECTION = "mt-[72px]";

/**
 * 01~08 표시 메타. FlowSectionKey 로 색인해 전수 커버리지를 강제한다 —
 * 레지스트리에 키가 하나 늘면 이 객체가 같이 늘지 않는 한 컴파일이 깨진다.
 *
 * 08 이 "이 해의 포인트" 인 것은 삭제의 흔적이다 — 변곡점 섹션(옛 08)이 07 로
 * 흡수되면서 뒤가 하나씩 당겨졌다. 변곡점 자체는 07 의 타임라인이 배지로 그린다.
 */
const SECTION_META: Record<FlowSectionKey, { no: string; category: string }> = {
  overview: { no: "01", category: "한 해의 흐름" },
  rising: { no: "02", category: "힘이 실리는 것" },
  straining: { no: "03", category: "부담되는 것" },
  work: { no: "04", category: "일과 선택" },
  relating: { no: "05", category: "관계" },
  money: { no: "06", category: "돈과 현실" },
  months: { no: "07", category: "월별 흐름" },
  closing: { no: "08", category: "이 해의 포인트" },
};

/**
 * 섹션을 확보하지 못한 이유. 사용자가 **지금 할 수 있는 일**이 갈리므로 나눈다 —
 * "failed" 만 새로고침이 통하고, 나머지 둘은 새로고침해도 같은 자리에 선다.
 *
 * 이 값은 이번 요청 안에서 정해진다(page.tsx 가 FlowGenerationError 를 갈라
 * 넘긴다). DB 에 적어 둘 필요가 없는 이유는, 이 안내를 그리는 요청이 곧 실패를
 * 겪은 그 요청이기 때문이다.
 */
export type FlowMissingReason = "failed" | "rate-limit" | "tickets";

const MISSING_COPY: Record<FlowMissingReason, string> = {
  // 새로고침을 안내하는 것은 빈말이 아니다 — 빠진 섹션은 다음 열람에서 missing 으로
  // 다시 잡혀 그것만 다시 만들어지고, entitlements 행이 남아 있어 spendTicket 이
  // kind:"already" 로 돌아오므로 이용권은 다시 깎이지 않는다.
  failed:
    "이 부분을 쓰는 중에 문제가 생겨 비워 뒀어요. 새로고침하면 이 부분만 다시 만들어요. 이용권은 다시 쓰이지 않아요.",
  // FlowRateLimited 와 같은 안내다. 여기서 새로고침을 권하면 한도만 더 먹는다.
  "rate-limit":
    "짧은 시간에 흐름을 너무 많이 열어서 이 부분은 아직 못 만들었어요. 잠시 후에 이 화면을 다시 열면 이어서 만들어 드려요.",
  tickets: "이용권이 모자라 이 부분은 아직 못 만들었어요. 이용권을 채우면 이어서 만들어 드려요.",
};

/**
 * 서술을 못 만든 섹션의 자리.
 *
 * 조용히 빼지 않는 이유: 번호가 화면에 박혀 있어서, 빼면 01 다음에 03 이 오는
 * 리포트가 된다. 사용자가 보기엔 "02 는 어디 갔지" 이고, 우리도 무엇이 빠졌는지
 * 화면만 봐서는 알 수 없다. 이용권을 쓴 결과물이라 빠졌다는 사실 자체를 숨기면
 * 안 된다. (FlowError·FlowRateLimited 와 같은 판단으로 버튼은 두지 않는다)
 */
function MissingSection({
  no,
  category,
  reason,
}: {
  no: string;
  category: string;
  reason: FlowMissingReason;
}) {
  return (
    <section className={SECTION}>
      <SectionHeadingRaw no={no} category={category} title="아직 만들어지지 않았어요" />
      <NoteCard>{MISSING_COPY[reason]}</NoteCard>
    </section>
  );
}

/**
 * 서술 8섹션 → 화면. interpretation 은 부분 생성 결과일 수 있어
 * (FlowGenerationError.partial) 확보하지 못한 섹션 자리에는 MissingSection 이 선다.
 *
 * 순회 대상이 sections 가 아니라 FLOW_SECTION_KEYS 인 것이 요점이다 — 확보한
 * 것만 훑으면 못 만든 섹션이 화면에서 흔적 없이 사라져 번호만 건너뛴다.
 *
 * 달 이름·기간·변곡점 강조는 전부 화면이 붙인다 — LLM 은 순번만 안다.
 * "변곡점 없음" 도 화면이 계산값으로 말한다: 없다는 말을 LLM 에 맡기면 안 쓰는
 * 날이 오고, 그때 화면만 봐서는 "없는 것" 과 "못 만든 것" 이 구분되지 않는다(§21).
 * 04 끝의 /consult, 05 끝의 /match 링크도 같은 이유로 화면이 붙인다(§32).
 */
export function FlowBody({
  sections,
  months,
  currentIndex,
  profileId,
  flowYear,
  missingReason,
}: {
  sections: FlowSectionView[];
  months: FlowMonth[];
  currentIndex: number | null;
  profileId: string;
  flowYear: number;
  missingReason: FlowMissingReason;
}) {
  const byKey = new Map(sections.map((v) => [v.key, v]));
  const hasPivots = months.some((m) => m.pivot);

  return (
    <>
      {FLOW_SECTION_KEYS.map((key) => {
        const { no, category } = SECTION_META[key];
        const view = byKey.get(key);
        if (!view) {
          return <MissingSection key={key} no={no} category={category} reason={missingReason} />;
        }

        if (key === "overview") {
          const c = view.content as OverviewContent;
          return (
            <section key={key} className={SECTION}>
              <SectionHeadingRaw no={no} category={category} title={c.title} />
              <NoteCard>{c.body}</NoteCard>
            </section>
          );
        }

        if (key === "months") {
          const c = view.content as MonthsContent;
          return (
            <section key={key} className={SECTION}>
              <SectionHeadingRaw no={no} category={category} title="이렇게 흘러가요" />
              <NoteCard>{c.lead}</NoteCard>
              {/* 변곡점 유무는 flows.months 에 박제된 계산 결과다. 있으면 타임라인이
                  "흐름이 바뀌는 달" 배지로 그리고, 없으면 여기서 없다고 말한다 —
                  배지가 하나도 없는 타임라인은 그 자체로는 아무 말도 하지 않는다. */}
              {!hasPivots && (
                <p className="mt-3 text-[13.5px] text-slate-500">
                  {flowYear}년은 흐름이 크게 꺾이는 달 없이 한 방향이 길게 이어져요.
                </p>
              )}
              <MonthTimeline content={c} months={months} currentIndex={currentIndex} />
            </section>
          );
        }

        if (key === "closing") {
          const c = view.content as ClosingContent;
          return (
            <section key={key} className={SECTION}>
              <SectionHeadingRaw no={no} category={category} title="기억할 것" />
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

        if (key === "rising" || key === "straining") {
          const c = view.content as ItemsContent;
          return (
            <section key={key} className={SECTION}>
              <SectionHeadingRaw no={no} category={category} title={c.lead} />
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
          <section key={key} className={SECTION}>
            <SectionHeadingRaw no={no} category={category} title={c.lead} />
            {/* 라벨 없는 카드(01 과 같은 NoteCard)다. InfoCard 에 category 를 라벨로
                주면 바로 위 헤딩의 "04 · 일과 선택" 과 같은 말이 카드 안에 또 선다. */}
            <NoteCard>{c.body}</NoteCard>
            {key === "work" && (
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
            {key === "relating" && (
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
