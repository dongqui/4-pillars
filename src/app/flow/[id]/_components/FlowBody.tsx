import Link from "next/link";
import type { FlowSegment } from "@/app/api/flows/_lib/segments";
import { FLOW_SECTION_KEYS, type FlowSectionKey } from "@/app/api/flows/_lib/sections";
import { SectionHeading } from "@/app/report/_components/SectionHeading";
import { InfoCard } from "@/app/report/_components/InfoCard";
import { NoteCard } from "@/app/report/_components/NoteCard";
import { segmentLabel } from "../_lib/current-segment";
import type { FlowSectionView } from "../_lib/to-flow-view";

const SECTION = "mt-[72px]";

interface SectionMeta {
  no: string;
  category: string;
}

/**
 * 01~08 표시 메타. FlowSectionKey 로 색인해 전수 커버리지를 강제한다 —
 * 레지스트리(FLOW_SECTIONS)에 키가 하나 늘면 이 객체가 같이 늘지 않는 한
 * 컴파일이 깨진다. 순서 자체는 이 객체가 정하지 않는다 — 아래 렌더는
 * FLOW_SECTION_KEYS(=레지스트리 선언 순서)를 그대로 돈다.
 */
const SECTION_META: Record<FlowSectionKey, SectionMeta> = {
  now: { no: "01", category: "지금의 흐름" },
  rising: { no: "02", category: "지금 살아나는 것" },
  straining: { no: "03", category: "지금 부담되는 것" },
  work: { no: "04", category: "일과 선택" },
  relating: { no: "05", category: "관계" },
  money: { no: "06", category: "돈과 현실" },
  ahead: { no: "07", category: "앞으로의 변화" },
  remember: { no: "08", category: "지금 기억할 것" },
};

/**
 * 서술 8섹션 + 흐름 구간 → 화면. interpretation 은 부분 생성 결과일 수 있어
 * (FlowGenerationError.partial) 각 섹션은 자기 키가 없으면 통째로 건너뛴다 —
 * MatchBody 와 같은 판단이다.
 *
 * 01~06·08 은 common(연간 배경) + current(읽는 시점의 구간 서술)을 보여준다.
 * 07(ahead)은 common 이 없고 전체 구간을 타임라인으로 늘어놓는다 — 이 섹션
 * 자체가 "무엇이 앞으로 달라지는가" 라서다.
 *
 * segmentLabel 은 화면이 붙인다 — LLM 은 시점을 쓰지 않는다(§12). 04 끝의
 * /consult, 05 끝의 /match 링크도 같은 이유로 화면이 붙인다.
 */
export function FlowBody({
  sections,
  segments,
  profileId,
}: {
  sections: FlowSectionView[];
  segments: FlowSegment[];
  profileId: string;
}) {
  const byKey = new Map(sections.map((s) => [s.key, s]));
  const findSegment = (id: string) => segments.find((s) => s.id === id);

  return (
    <>
      {FLOW_SECTION_KEYS.map((key) => {
        const view = byKey.get(key);
        if (!view) return null;
        const meta = SECTION_META[key];

        if (key === "ahead") {
          const currentId = view.current?.segmentId ?? null;
          return (
            <section key={key} className={SECTION}>
              <SectionHeading no={meta.no} category={meta.category} title="한 해의 흐름" />
              <div className="flex flex-col gap-3">
                {view.all.map((body) => {
                  const segment = findSegment(body.segmentId);
                  const isCurrent = body.segmentId === currentId;
                  const label = segment ? segmentLabel(segment) : body.segmentId;
                  return (
                    <InfoCard key={body.segmentId} label={isCurrent ? `${label} · 지금` : label}>
                      <span className="block font-semibold text-slate-800 mb-1">{body.title}</span>
                      {body.body}
                    </InfoCard>
                  );
                })}
              </div>
            </section>
          );
        }

        if (!view.current) return null;
        const segment = findSegment(view.current.segmentId);

        return (
          <section key={key} className={SECTION}>
            <SectionHeading no={meta.no} category={meta.category} title={view.current.title} />
            {view.common && <NoteCard>{view.common}</NoteCard>}
            <div className="mt-3">
              <InfoCard label={segment ? segmentLabel(segment) : "지금"}>{view.current.body}</InfoCard>
            </div>
            {key === "work" && (
              <p className="mt-5 text-[13.5px] text-slate-500">
                더 깊이 이야기하고 싶다면{" "}
                <Link
                  href={`/consult?profile=${profileId}`}
                  className="font-semibold text-slate-700 underline underline-offset-2"
                >
                  고민상담
                </Link>
                에서 풀어볼 수 있어요.
              </p>
            )}
            {key === "relating" && (
              <p className="mt-5 text-[13.5px] text-slate-500">
                그 사람과의 흐름이 궁금하다면{" "}
                <Link href="/match" className="font-semibold text-slate-700 underline underline-offset-2">
                  궁합
                </Link>
                도 함께 볼 수 있어요.
              </p>
            )}
          </section>
        );
      })}
    </>
  );
}
