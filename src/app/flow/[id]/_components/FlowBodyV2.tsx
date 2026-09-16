import Link from "next/link";
import type { FlowMonth } from "@/app/api/flows/_lib/pivots";
import type { PublicDomain, PublicFlowReportV2 } from "@/app/api/flows/_lib/v2/presentation";
import { InfoCard } from "@/app/report/_components/InfoCard";
import { NoteCard } from "@/app/report/_components/NoteCard";
import { CTA, DISCLAIMER, NO_PIVOT_COPY, REFERENCE_COPY, V2_SECTIONS, monthAnchor } from "../_lib/v2-sections";
import { monthRange } from "../_lib/current-month";
import { MonthTimelineV2 } from "./MonthTimelineV2";

const SECTION = "mt-[72px]";

/** SectionHeadingRaw 의 첫 줄과 같은 클래스 — "no · title" 한 줄이 전부다(v2 는 카테고리·제목이 분리되지 않는다). */
function V2Heading({ no, title }: { no: string; title: string }) {
  return <div className="mb-5 text-xs font-bold tracking-[0.08em] text-slate-400">{no} · {title}</div>;
}

function DomainCard({
  no,
  title,
  domain,
  months,
  cta,
}: {
  no: string;
  title: string;
  domain: PublicDomain;
  months: FlowMonth[];
  cta?: { href: string; label: string };
}) {
  return (
    <section className={SECTION}>
      <V2Heading no={no} title={title} />
      <p className="text-[15px] font-semibold leading-[1.5] tracking-[-0.02em] text-slate-900">
        {domain.headline}
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <InfoCard label="기회">{domain.opportunity}</InfoCard>
        <InfoCard label="주의할 점">{domain.caution}</InfoCard>
        <InfoCard label="이렇게 해보세요">{domain.action}</InfoCard>
      </div>
      {domain.monthLinks.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {domain.monthLinks.map((l) => {
            const meta = months[l.monthIndex - 1];
            if (!meta) return null;
            return (
              <li key={l.monthIndex}>
                <a
                  href={`#${monthAnchor(l.monthIndex)}`}
                  className="text-[13px] font-semibold text-slate-600 underline underline-offset-2"
                >
                  {monthRange(meta)} · {l.note}
                </a>
              </li>
            );
          })}
        </ul>
      )}
      {cta && (
        <p className="mt-5 text-[13.5px] text-slate-500">
          <Link href={cta.href} className="font-semibold text-slate-700 underline underline-offset-2">
            {cta.label}
          </Link>
        </p>
      )}
    </section>
  );
}

/**
 * v2 결과 화면 본문. 7섹션을 V2_SECTIONS 순서대로 그린다 — LLM 은 순번만 안다,
 * 달 이름·기간·변곡점 강조·CTA 는 전부 화면이 붙인다(FlowBody.tsx 와 같은 판단).
 */
export function FlowBodyV2({
  report,
  months,
  currentIndex,
  profileId,
}: {
  report: PublicFlowReportV2;
  months: FlowMonth[];
  currentIndex: number | null;
  profileId: string;
}) {
  const hasPivots = months.some((m) => m.pivot);
  const referenceCopy = REFERENCE_COPY[report.reference];

  return (
    <>
      {referenceCopy && (
        <p className="mt-6 text-center text-[12px] text-slate-400">{referenceCopy}</p>
      )}

      {/* 01 · 총운 */}
      <section className={SECTION}>
        <V2Heading no={V2_SECTIONS[0].no} title={V2_SECTIONS[0].title} />
        <NoteCard>{report.sections.overview.body}</NoteCard>
      </section>

      {/* 02 · (career) */}
      <DomainCard
        no={V2_SECTIONS[1].no}
        title={V2_SECTIONS[1].title ?? report.careerTitle}
        domain={report.sections.career}
        months={months}
        cta={CTA.career(profileId)}
      />

      {/* 03 · 재물운 */}
      <DomainCard
        no={V2_SECTIONS[2].no}
        title={V2_SECTIONS[2].title}
        domain={report.sections.money}
        months={months}
      />

      {/* 04 · 연애운 */}
      <DomainCard
        no={V2_SECTIONS[3].no}
        title={V2_SECTIONS[3].title}
        domain={report.sections.romance}
        months={months}
        cta={CTA.romance()}
      />

      {/* 05 · 대인운 */}
      <DomainCard
        no={V2_SECTIONS[4].no}
        title={V2_SECTIONS[4].title}
        domain={report.sections.relationships}
        months={months}
        cta={CTA.relationships()}
      />

      {/* 06 · 월별 운세 */}
      <section className={SECTION}>
        <V2Heading no={V2_SECTIONS[5].no} title={V2_SECTIONS[5].title} />
        <NoteCard>{report.sections.months.lead}</NoteCard>
        {!hasPivots && (
          <p className="mt-3 text-[13.5px] text-slate-500">{NO_PIVOT_COPY}</p>
        )}
        <MonthTimelineV2 items={report.sections.months.items} months={months} currentIndex={currentIndex} />
      </section>

      {/* 07 · 이 해를 잘 보내는 법 */}
      <section className={SECTION}>
        <V2Heading no={V2_SECTIONS[6].no} title={V2_SECTIONS[6].title} />
        <div className="flex flex-col gap-3">
          {report.sections.closing.items.map((item) => (
            <InfoCard key={item.title} label={item.title}>
              {item.body}
            </InfoCard>
          ))}
        </div>
      </section>

      <p className="mt-16 text-center text-[12px] leading-[1.6] text-slate-400 [text-wrap:pretty]">
        {DISCLAIMER}
      </p>
    </>
  );
}
