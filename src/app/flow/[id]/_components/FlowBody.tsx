import Link from "next/link";
import type { FlowSegment } from "@/app/api/flows/_lib/segments";
import { SectionHeading } from "@/app/report/_components/SectionHeading";
import { InfoCard } from "@/app/report/_components/InfoCard";
import { NoteCard } from "@/app/report/_components/NoteCard";
import { segmentLabel } from "../_lib/current-segment";
import type { FlowSectionView } from "../_lib/to-flow-view";

const SECTION = "mt-[72px]";

interface SectionMeta {
  key: string;
  no: string;
  category: string;
}

/** 01~06 — FLOW_SECTIONS(api/flows/_lib/sections/registry.ts)와 같은 순서·번호·이름. */
const BEFORE_TIMELINE: SectionMeta[] = [
  { key: "now", no: "01", category: "지금의 흐름" },
  { key: "rising", no: "02", category: "지금 살아나는 것" },
  { key: "straining", no: "03", category: "지금 부담되는 것" },
  { key: "work", no: "04", category: "일과 선택" },
  { key: "relating", no: "05", category: "관계" },
  { key: "money", no: "06", category: "돈과 현실" },
];

/** 08 — 07(ahead) 타임라인 다음에 온다. */
const AFTER_TIMELINE: SectionMeta[] = [{ key: "remember", no: "08", category: "지금 기억할 것" }];

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

  const renderSegmented = (meta: SectionMeta) => {
    const view = byKey.get(meta.key);
    if (!view?.current) return null;
    const segment = findSegment(view.current.segmentId);

    return (
      <section key={meta.key} className={SECTION}>
        <SectionHeading no={meta.no} category={meta.category} title={view.current.title} />
        {view.common && <NoteCard>{view.common}</NoteCard>}
        <div className="mt-3">
          <InfoCard label={segment ? segmentLabel(segment) : "지금"}>{view.current.body}</InfoCard>
        </div>
        {meta.key === "work" && (
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
        {meta.key === "relating" && (
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
  };

  const ahead = byKey.get("ahead");
  const currentAheadId = ahead?.current?.segmentId ?? null;

  return (
    <>
      {BEFORE_TIMELINE.map(renderSegmented)}

      {ahead && (
        <section key="ahead" className={SECTION}>
          <SectionHeading no="07" category="앞으로의 변화" title="한 해의 흐름" />
          <div className="flex flex-col gap-3">
            {ahead.all.map((body) => {
              const segment = findSegment(body.segmentId);
              const isCurrent = body.segmentId === currentAheadId;
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
      )}

      {AFTER_TIMELINE.map(renderSegmented)}
    </>
  );
}
