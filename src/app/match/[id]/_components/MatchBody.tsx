import type { ReactNode } from "react";
import type { MatchInterpretation } from "@/app/api/matches/_lib/sections";
import type { RelationInput } from "@/lib/matches/relation-types";
import { SectionHeadingRaw } from "@/app/report/_components/SectionHeading";
import { CardGrid } from "@/app/report/_components/CardGrid";
import { InfoCard } from "@/app/report/_components/InfoCard";
import { NoteCard } from "@/app/report/_components/NoteCard";
import { matchSectionHeadings, type SectionHeadingView } from "../_lib/to-section-headings";

const SECTION = "mt-[72px]";
/** 한 섹션 안에서 카드 묶음을 가르는 눈썹 라벨 — report 의 OuterInnerSection 과 같은 자리다. */
const GROUP = "text-xs font-bold text-slate-400 tracking-[0.05em] mb-2.5";

/**
 * 제목 한 벌 + 본문. 열 섹션이 전부 이 모양이라 한 자리에 접는다.
 *
 * head.title 이 null 인 자리(01 총평)는 title prop 으로 내용에서 온 제목을 받는다.
 */
function Section({
  head,
  title,
  children,
}: {
  head: SectionHeadingView;
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className={SECTION}>
      <SectionHeadingRaw no={head.no} category={head.category} title={title ?? head.title ?? ""} />
      {children}
    </section>
  );
}

/** LabeledText 배열 → 카드 그리드. 다섯 자리에서 반복된다. */
function LabeledCards({
  items,
  idPrefix,
}: {
  items: readonly { label: string; body: string }[];
  idPrefix: string;
}) {
  return (
    <CardGrid>
      {items.map((item, i) => (
        <InfoCard key={`${idPrefix}-${i}`} label={item.label}>
          {item.body}
        </InfoCard>
      ))}
    </CardGrid>
  );
}

/**
 * 일곱 개의 생성 단위를 열 개의 화면 섹션으로 편다 — bond 가 04·05 를, together 가
 * 06·07 을, conflict 가 08·09 를 각각 두 섹션으로 나눠 그린다.
 *
 * 제목은 여기서 정하지 않는다. 관계 유형에 따라 갈리는 제목을 JSX 안에서 고르면
 * 번호와 문구가 조건문으로 흩어지므로 to-section-headings 가 한 번에 준다.
 *
 * interpretation 은 부분 생성 결과일 수 있다(MatchGenerationError.partial). 각 섹션은
 * 자기 키가 없으면 통째로 건너뛴다 — 빈 SectionHeadingRaw 만 남는 블록을 만들지 않기
 * 위해서다. 묶인 콜이 죽으면 그 콜이 만드는 두 화면이 함께 빠진다.
 */
export function MatchBody({
  interpretation,
  relation,
}: {
  interpretation: Partial<MatchInterpretation>;
  relation: RelationInput;
}) {
  const head = matchSectionHeadings(relation);
  const { verdict, chemistry, closeness, bond, together, conflict, advice } = interpretation;

  return (
    <>
      {verdict && (
        <Section head={head.verdict} title={verdict.headline}>
          <NoteCard>{verdict.summary}</NoteCard>
        </Section>
      )}

      {chemistry && (
        <Section head={head.chemistry}>
          {/*
            두 묶음에 라벨을 붙인다. 섹션 프롬프트가 "두 항목이 서로를 비추도록 써라"
            라고 지시하므로 pull 과 friction 은 일부러 닮은 문장으로 나온다 — 라벨이
            없으면 어느 카드가 어느 쪽인지 읽는 사람이 가릴 수 없고, 둘을 한 섹션으로
            합친 이유(대비가 요점이다)가 그대로 사라진다.
          */}
          <div className={GROUP}>끌리는 지점</div>
          <CardGrid>
            {chemistry.pull.map((item, i) => (
              <InfoCard key={`pull-${i}`} label={item.title}>
                {item.body}
              </InfoCard>
            ))}
          </CardGrid>
          <div className="mt-7">
            <div className={GROUP}>부딪히는 지점</div>
            <CardGrid>
              {chemistry.friction.map((item, i) => (
                <InfoCard key={`friction-${i}`} label={item.title}>
                  {item.body}
                </InfoCard>
              ))}
            </CardGrid>
          </div>
        </Section>
      )}

      {closeness && (
        <Section head={head.closeness}>
          <LabeledCards items={closeness} idPrefix="closeness" />
        </Section>
      )}

      {bond && (
        <>
          <Section head={head.eachSide}>
            <CardGrid>
              <InfoCard label="나에게">{bond.toMe}</InfoCard>
              <InfoCard label="상대에게">{bond.toYou}</InfoCard>
            </CardGrid>
          </Section>

          <Section head={head.change}>
            <CardGrid>
              <InfoCard label="내가 받는 변화">{bond.changeInMe}</InfoCard>
              <InfoCard label="상대가 받는 변화">{bond.changeInYou}</InfoCard>
            </CardGrid>
            <div className="mt-7">
              <div className={GROUP}>둘 사이에 생기는 변화</div>
              <NoteCard>{bond.changeBetween}</NoteCard>
            </div>
          </Section>
        </>
      )}

      {together && (
        <>
          <Section head={head.presence}>
            <LabeledCards items={together.now} idPrefix="now" />
          </Section>

          <Section head={head.continuity}>
            <LabeledCards items={together.later} idPrefix="later" />
          </Section>
        </>
      )}

      {conflict && (
        <>
          <Section head={head.triggers}>
            <LabeledCards items={conflict.triggers} idPrefix="trigger" />
          </Section>

          <Section head={head.recovery}>
            <CardGrid>
              <InfoCard label="갈등이 시작되면">{conflict.onset}</InfoCard>
              <InfoCard label="감정이 커지면">{conflict.escalation}</InfoCard>
              <InfoCard label="다시 관계를 회복할 때">{conflict.recovery}</InfoCard>
            </CardGrid>
            <div className="mt-7">
              <div className={GROUP}>놓치기 쉬운 부분</div>
              <NoteCard>{conflict.blindSpot}</NoteCard>
            </div>
          </Section>
        </>
      )}

      {advice && (
        <Section head={head.advice}>
          {/*
            라벨이 조언 자체다 — 기획안 §13 이 "실천 1/2/3 으로 표시하지 않는다" 고
            못박은 자리이고, 스키마가 TitledText 인 이유가 이것이다.
          */}
          <CardGrid>
            {advice.items.map((item, i) => (
              <InfoCard key={`advice-${i}`} label={item.title}>
                {item.body}
              </InfoCard>
            ))}
          </CardGrid>
          <NoteCard tip>{advice.first}</NoteCard>
        </Section>
      )}
    </>
  );
}
