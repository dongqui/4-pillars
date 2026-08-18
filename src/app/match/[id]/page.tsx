import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { analyze, analyzeSynastry, type SajuAnalysis, type Synastry } from "@/lib/saju-core";
import { getSession } from "@/lib/auth/session";
import { getMatch } from "@/lib/matches/store";
import { getProfile, type ProfileRow } from "@/lib/profiles/store";
import { toBirthInput } from "@/lib/profiles/to-birth-input";
import { first, type SearchParams } from "@/lib/profiles/param";
import { MATCH_SECTION_KEYS, type MatchInterpretation } from "@/app/api/matches/_lib/sections";
import { createMatchGenerator } from "@/app/api/matches/_lib/generator";
import { gateMatchGeneration, isMatchRateLimited } from "@/app/api/matches/_lib/gated-generator";
import { getMatchSections, putMatchSections } from "@/app/api/matches/_lib/store";
import { MatchGenerationError, produceMatchSections } from "@/app/api/matches/_lib/produce";
import { toMatchHeroView } from "./_lib/to-match-view";
import { MatchShell } from "./_components/MatchShell";
import { MatchHero } from "./_components/MatchHero";
import { MatchBody } from "./_components/MatchBody";
import { AnalyzingMatch } from "./_components/AnalyzingMatch";
import { MatchError } from "./_components/MatchError";
import { MatchRateLimited } from "./_components/MatchRateLimited";
import { SaveCounterpartModal } from "./_components/SaveCounterpartModal";

/**
 * 궁합은 저장된 것이 없으면 5섹션을 전부 새로 생성한다 — 리포트와 달리
 * 사람 사이에 공유되는 캐시가 없어 첫 열람은 언제나 풀 생성이다.
 */
export const maxDuration = 60;

interface Pair {
  subject: SajuAnalysis;
  counterpart: SajuAnalysis;
  synastry: Synastry;
}

/**
 * 원국 계산은 던질 수 있다. createProfileSchema 가 year 2200 · day 31 까지 받으므로
 * API 로 만든 프로필은 퍼널로는 나올 수 없는 날짜를 들고 있을 수 있다.
 *
 * 던지게 두지 않는 이유는 report/page.tsx 와 같다: src/app 아래에 error.tsx 가 하나도
 * 없어 잡히지 않은 예외는 헤더도 출구도 없는 Next 기본 에러 화면이 된다.
 */
function analyzePair(subject: ProfileRow, counterpart: ProfileRow): Pair | null {
  try {
    const s = analyze(toBirthInput(subject));
    const c = analyze(toBirthInput(counterpart));
    return { subject: s, counterpart: c, synastry: analyzeSynastry(s, c) };
  } catch (e) {
    console.error("[/match/[id]] 원국 계산 실패", e);
    return null;
  }
}

export default async function MatchResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect(`/login?next=/match/${id}`);

  const match = await getMatch(session.userId, id);
  if (!match) notFound();

  const [subject, counterpart] = await Promise.all([
    getProfile(session.userId, match.subjectProfileId),
    getProfile(session.userId, match.counterpartProfileId),
  ]);
  if (!subject || !counterpart) notFound();

  const pair = analyzePair(subject, counterpart);
  // 계산이 깨지면 히어로도 못 만든다 — 껍데기만 남기고 안내로 끝낸다.
  if (!pair) {
    return (
      <MatchShell>
        <MatchError />
      </MatchShell>
    );
  }

  const hero = toMatchHeroView({
    synastry: pair.synastry,
    relation: match.relation,
    subjectName: subject.name,
    counterpartName: counterpart.name,
  });

  // 즉석 입력(?new=1)이었고 아직 내 목록에 없는(kind==='other') 상대일 때만 묻는다 —
  // 이미 저장된 사람에게 같은 질문을 또 던지지 않는다.
  const offerSave = first(sp.new) === "1" && counterpart.kind === "other";

  return (
    <MatchShell>
      <MatchHero view={hero} />
      {offerSave && (
        <SaveCounterpartModal counterpartId={counterpart.id} counterpartName={counterpart.name} />
      )}
      <Suspense fallback={<AnalyzingMatch />}>
        <MatchSections
          matchId={match.id}
          userId={session.userId}
          ctx={{ ...pair, relation: match.relation }}
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
async function MatchSections({
  matchId,
  userId,
  ctx,
}: {
  matchId: string;
  userId: string;
  ctx: Parameters<typeof produceMatchSections>[1];
}) {
  let interpretation: Partial<MatchInterpretation>;
  let rateLimited = false;
  try {
    // report/page.tsx 처럼 sharedGenerator() 로 모듈 스코프에 캐시하지 않는다 — 그러면
    // API 키 미설정 같은 생성기 구성 실패가 <Suspense> 밖, try 바깥에서 던져져 Next 의
    // 기본 에러 화면으로 떨어진다(report 가 그렇다). 여기서는 그 생성 자체를 이 try
    // 안에, <Suspense> 안에 두어 같은 실패가 catch 로 잡히고 이미 스트리밍된
    // MatchShell/MatchHero 아래에 <MatchError /> 가 뜬다 — 헤더 없는 화면보다 낫다.
    // 대가는 정직하게: 요청마다 새로 만들어 report 처럼 클라이언트를 공유하지 않는다.
    //
    // 한도는 여기, 생성기를 감싸서 씌운다. produceMatchSections 는 저장소에 없는 섹션이
    // 있을 때만 생성기를 부르므로 이미 다 저장된 궁합을 다시 여는 것은 세지 않는다.
    ({ interpretation } = await produceMatchSections(matchId, ctx, {
      generator: gateMatchGeneration(createMatchGenerator(), userId),
      getStored: getMatchSections,
      putStored: putMatchSections,
      sectionKeys: MATCH_SECTION_KEYS,
    }));
  } catch (e) {
    if (e instanceof MatchGenerationError) {
      // 한도에 걸린 것은 실패가 아니다 — 이미 저장된 섹션만으로 이어가되, 보여줄 것이
      // 하나도 없으면 아래에서 다른 문구로 안내한다(report/page.tsx 와 같은 처리).
      if (isMatchRateLimited(e)) rateLimited = true;
      else console.error("[/match/[id]] 해석 생성 실패", e);
      // 일부라도 확보했으면 그것까지는 보여준다 — 이용권을 쓴 결과다.
      interpretation = e.partial;
    } else {
      // DB 오류 · DEEP_SEEK_API_KEY 누락(createMatchGenerator) 등은 여기서 삼킨다.
      console.error("[/match/[id]] 해석 확보 실패", e);
      return <MatchError />;
    }
  }
  if (Object.keys(interpretation).length === 0) {
    return rateLimited ? <MatchRateLimited /> : <MatchError />;
  }
  return <MatchBody interpretation={interpretation} />;
}
