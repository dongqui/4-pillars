import type { MatchInterpretation } from "@/app/api/matches/_lib/sections";
import { SectionHeading } from "@/app/report/_components/SectionHeading";
import { CardGrid } from "@/app/report/_components/CardGrid";
import { InfoCard } from "@/app/report/_components/InfoCard";
import { NoteCard } from "@/app/report/_components/NoteCard";

const SECTION = "mt-[72px]";

/**
 * 다섯 섹션을 리포트의 카드 컴포넌트(SectionHeading·CardGrid·InfoCard·NoteCard)로
 * 조립한다 — 새 카드 컴포넌트를 만들지 않는다.
 *
 * interpretation 은 부분 생성 결과일 수 있다(MatchGenerationError.partial). 각
 * 섹션은 자기 키가 없으면 통째로 건너뛴다 — 빈 SectionHeading 만 남는 블록을
 * 만들지 않기 위해서다.
 */
export function MatchBody({ interpretation }: { interpretation: Partial<MatchInterpretation> }) {
  return (
    <>
      {interpretation.verdict && (
        <section className={SECTION}>
          <SectionHeading no="01" category="총평" title={interpretation.verdict.headline} />
          <NoteCard>{interpretation.verdict.summary}</NoteCard>
        </section>
      )}

      {interpretation.chemistry && (
        <section className={SECTION}>
          <SectionHeading no="02" category="케미" title="끌리는 지점과 부딪히는 지점" />
          <CardGrid>
            {interpretation.chemistry.pull.map((item, i) => (
              <InfoCard key={`pull-${i}`} label={item.title}>
                {item.body}
              </InfoCard>
            ))}
          </CardGrid>
          <div className="mt-3">
            <CardGrid>
              {interpretation.chemistry.friction.map((item, i) => (
                <InfoCard key={`friction-${i}`} label={item.title}>
                  {item.body}
                </InfoCard>
              ))}
            </CardGrid>
          </div>
        </section>
      )}

      {interpretation.eachSide && (
        <section className={SECTION}>
          <SectionHeading no="03" category="서로에게" title="같은 관계, 다르게 보이는 자리" />
          <CardGrid>
            <InfoCard label="나에게">{interpretation.eachSide.toMe}</InfoCard>
            <InfoCard label="상대에게">{interpretation.eachSide.toYou}</InfoCard>
          </CardGrid>
        </section>
      )}

      {interpretation.moments && (
        <section className={SECTION}>
          <SectionHeading no="04" category="흔들리는 순간" title="관계가 흔들리기 쉬운 국면" />
          <CardGrid>
            {interpretation.moments.map((item, i) => (
              <InfoCard key={`${item.label}-${i}`} label={item.label}>
                {item.body}
              </InfoCard>
            ))}
          </CardGrid>
        </section>
      )}

      {interpretation.bridge && (
        <section className={SECTION}>
          <SectionHeading no="05" category="다가가는 법" title="이 관계를 낫게 만드는 실천" />
          <CardGrid>
            {interpretation.bridge.items.map((item, i) => (
              <InfoCard key={i} label={`실천 ${i + 1}`}>
                {item}
              </InfoCard>
            ))}
          </CardGrid>
          <NoteCard tip>{interpretation.bridge.tip}</NoteCard>
        </section>
      )}
    </>
  );
}
