import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { analyze, analyzeSynastry } from "@/lib/saju-core";
import { getSession } from "@/lib/auth/session";
import { getMatch } from "@/lib/matches/store";
import { getProfile } from "@/lib/profiles/store";
import { toBirthInput } from "@/lib/profiles/to-birth-input";
import { MATCH_SECTION_KEYS, type MatchInterpretation } from "@/app/api/matches/_lib/sections";
import { createMatchGenerator } from "@/app/api/matches/_lib/generator";
import { getMatchSections, putMatchSections } from "@/app/api/matches/_lib/store";
import { MatchGenerationError, produceMatchSections } from "@/app/api/matches/_lib/produce";
import { toMatchHeroView } from "./_lib/to-match-view";
import { MatchShell } from "./_components/MatchShell";
import { MatchHero } from "./_components/MatchHero";
import { MatchBody } from "./_components/MatchBody";
import { AnalyzingMatch } from "./_components/AnalyzingMatch";
import { MatchError } from "./_components/MatchError";

/**
 * 궁합은 저장된 것이 없으면 5섹션을 전부 새로 생성한다 — 리포트와 달리
 * 사람 사이에 공유되는 캐시가 없어 첫 열람은 언제나 풀 생성이다.
 */
export const maxDuration = 60;

export default async function MatchResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/match/${id}`);

  const match = await getMatch(session.userId, id);
  if (!match) notFound();

  const [subject, counterpart] = await Promise.all([
    getProfile(session.userId, match.subjectProfileId),
    getProfile(session.userId, match.counterpartProfileId),
  ]);
  if (!subject || !counterpart) notFound();

  const subjectAnalysis = analyze(toBirthInput(subject));
  const counterpartAnalysis = analyze(toBirthInput(counterpart));
  const synastry = analyzeSynastry(subjectAnalysis, counterpartAnalysis);

  const hero = toMatchHeroView({
    synastry,
    relation: match.relation,
    subjectName: subject.name,
    counterpartName: counterpart.name,
  });

  return (
    <MatchShell>
      <MatchHero view={hero} />
      <Suspense fallback={<AnalyzingMatch />}>
        <MatchSections
          matchId={match.id}
          ctx={{ subject: subjectAnalysis, counterpart: counterpartAnalysis, synastry, relation: match.relation }}
        />
      </Suspense>
    </MatchShell>
  );
}

/**
 * 느린 자리는 여기뿐이다.
 *
 * 성공 경로의 JSX 는 try 바깥에서 만든다 — try 안에서 만들면 렌더 자체가 던지는
 * 에러는 어차피 이 catch 가 잡지 못하는데(react-hooks/error-boundaries), 잡는
 * 것처럼 보이는 코드가 된다. catch 는 produceMatchSections 호출 실패만 다룬다.
 */
async function MatchSections({ matchId, ctx }: { matchId: string; ctx: Parameters<typeof produceMatchSections>[1] }) {
  let interpretation: Partial<MatchInterpretation>;
  try {
    ({ interpretation } = await produceMatchSections(matchId, ctx, {
      generator: createMatchGenerator(),
      getStored: getMatchSections,
      putStored: putMatchSections,
      sectionKeys: MATCH_SECTION_KEYS,
    }));
  } catch (e) {
    // 일부라도 확보했으면 그것까지는 보여준다 — 이용권을 쓴 결과다.
    if (e instanceof MatchGenerationError && Object.keys(e.partial).length > 0) {
      return <MatchBody interpretation={e.partial} />;
    }
    return <MatchError />;
  }
  return <MatchBody interpretation={interpretation} />;
}
