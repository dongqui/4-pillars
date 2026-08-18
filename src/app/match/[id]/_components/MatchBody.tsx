import type { MatchInterpretation } from "@/app/api/matches/_lib/sections";
import { SectionHeading } from "@/app/report/_components/SectionHeading";
import { CardGrid } from "@/app/report/_components/CardGrid";
import { InfoCard } from "@/app/report/_components/InfoCard";
import { NoteCard } from "@/app/report/_components/NoteCard";

const SECTION = "mt-[72px]";
/** 한 섹션 안에서 카드 묶음을 가르는 눈썹 라벨 — report 의 OuterInnerSection 과 같은 자리다. */
const GROUP = "text-xs font-bold text-slate-400 tracking-[0.05em] mb-2.5";

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
          {/*
            두 묶음에 라벨을 붙인다. 섹션 프롬프트가 "두 항목이 서로를 비추도록 써라"
            라고 지시하므로 pull 과 friction 은 일부러 닮은 문장으로 나온다 — 라벨이
            없으면 어느 카드가 어느 쪽인지 읽는 사람이 가릴 수 없고, 둘을 한 섹션으로
            합친 이유(대비가 요점이다)가 그대로 사라진다.
          */}
          <div className={GROUP}>끌리는 지점</div>
          <CardGrid>
            {interpretation.chemistry.pull.map((item, i) => (
              <InfoCard key={`pull-${i}`} label={item.title}>
                {item.body}
              </InfoCard>
            ))}
          </CardGrid>
          <div className="mt-7">
            <div className={GROUP}>부딪히는 지점</div>
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
