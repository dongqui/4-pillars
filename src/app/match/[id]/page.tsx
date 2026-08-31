import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { analyze, analyzeSynastry, type SajuAnalysis, type Synastry } from "@/lib/saju-core";
import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/users";
import { resolveDisplayName } from "@/lib/auth/display-name";
import { getMatch } from "@/lib/matches/store";
import { getProfile, type ProfileRow } from "@/lib/profiles/store";
import { toBirthInput } from "@/lib/profiles/to-birth-input";
import { MATCH_SECTION_KEYS, type MatchInterpretation } from "@/app/api/matches/_lib/sections";
import { createMatchGenerator } from "@/app/api/matches/_lib/generator";
import {
  gateMatchGeneration,
  isMatchOutOfTickets,
  isMatchRateLimited,
  spendOnMatchGeneration,
} from "@/app/api/matches/_lib/gated-generator";
import {
  getMatchSections,
  putMatchSections,
  type StoredMatchSections,
} from "@/app/api/matches/_lib/store";
import { MatchGenerationError, produceMatchSections } from "@/app/api/matches/_lib/produce";
import { toMatchHeroView, type MatchHeroView } from "./_lib/to-match-view";
import { matchLoadingMode } from "./_lib/to-loading-mode";
import { MatchShell } from "./_components/MatchShell";
import { MatchHero } from "./_components/MatchHero";
import { MatchBody } from "./_components/MatchBody";
import { AnalyzingMatch, AnalyzingRestOfMatch } from "./_components/AnalyzingMatch";
import { MatchError } from "./_components/MatchError";
import { MatchRateLimited } from "./_components/MatchRateLimited";
import { MatchOutOfTickets } from "./_components/MatchOutOfTickets";

/**
 * 궁합은 저장된 것이 없으면 일곱 섹션을 전부 새로 생성한다 — 리포트와 달리
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/match/${id}`);

  const match = await getMatch(session.userId, id);
  if (!match) notFound();

  const [subject, counterpart, user] = await Promise.all([
    getProfile(session.userId, match.subjectProfileId),
    getProfile(session.userId, match.counterpartProfileId),
    getUser(session.userId),
  ]);
  if (!subject || !counterpart) notFound();
  const displayName = resolveDisplayName(user);

  const pair = analyzePair(subject, counterpart);
  // 계산이 깨지면 히어로도 못 만든다 — 껍데기만 남기고 안내로 끝낸다.
  if (!pair) {
    return (
      <MatchShell displayName={displayName}>
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

  // 저장된 섹션을 먼저 읽는다. DB 한 번이라 빠르고, 여기서 읽어 두면 두 가지가 갈린다:
  // 생성기를 아예 만들지 않아도 되는 경우와, 기다리는 동안 보여줄 것이 있는 경우.
  const stored = await getMatchSections(match.id, MATCH_SECTION_KEYS);
  const mode = matchLoadingMode(stored);

  // 다 있으면 <Suspense> 자체를 세우지 않는다. 스피너가 한 프레임도 스치지 않는다.
  if (mode === "complete") {
    return (
      <MatchShell displayName={displayName}>
        <MatchHero view={hero} />
        <MatchBody interpretation={stored.have} relation={match.relation} />
      </MatchShell>
    );
  }

  /*
    fallback 에 스피너 대신 **이미 저장된 섹션**을 넣는다.

    이게 이 파일에서 가장 중요한 결정이다. 예전에는 섹션 하나가 없으면 나머지 여섯이
    DB 에 멀쩡히 있는데도 화면 전체가 스피너였다 — 한 섹션의 LLM 왕복을 기다리느라
    이미 확보한 것을 볼모로 잡은 셈이다. fallback 을 부분 본문으로 두면 번호 순서가
    그대로 유지된 채 있는 것부터 읽히고, 생성이 끝나면 완성본으로 갈린다.

    저장된 것이 하나도 없을 때만 순수 스피너다. 그때는 히어로도 함께 감춘다 — 보여줄
    본문이 없는 화면에 이름과 아바타만 떠 있으면 기다림이 더 길게 느껴진다.
  */
  const fallback =
    mode === "partial" ? (
      <>
        <MatchHero view={hero} />
        <MatchBody interpretation={stored.have} relation={match.relation} />
        <AnalyzingRestOfMatch />
      </>
    ) : (
      <AnalyzingMatch />
    );

  return (
    <MatchShell displayName={displayName}>
      {/* 히어로는 <Suspense> 안쪽이다 — 본문이 없는 로딩 화면에 이름만 뜨지 않게. */}
      <Suspense fallback={fallback}>
        <MatchSections
          matchId={match.id}
          userId={session.userId}
          hero={hero}
          stored={stored}
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
  hero,
  stored,
  ctx,
}: {
  matchId: string;
  userId: string;
  /** 히어로도 이 안에서 그린다 — 본문과 함께 나타나야 로딩 화면이 깨끗하다. */
  hero: MatchHeroView;
  /** 페이지가 이미 읽어 둔 것. 같은 쿼리를 두 번 던지지 않는다. */
  stored: StoredMatchSections;
  ctx: Parameters<typeof produceMatchSections>[1];
}) {
  let interpretation: Partial<MatchInterpretation>;
  let rateLimited = false;
  let outOfTickets = false;
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
    // 이용권도 같은 자리다 — 한도가 바깥, 이용권이 안쪽이다. 한도 확인은 Redis 한 번이고
    // 차감은 DB 쓰기라, 싼 쪽이 먼저 막아야 한다.
    ({ interpretation } = await produceMatchSections(matchId, ctx, {
      generator: gateMatchGeneration(
        spendOnMatchGeneration(createMatchGenerator(), { userId, matchId }),
        userId,
      ),
      // 페이지가 방금 읽은 것을 그대로 쓴다. 같은 쿼리를 두 번 던질 이유가 없다.
      getStored: async () => stored,
      putStored: putMatchSections,
      sectionKeys: MATCH_SECTION_KEYS,
    }));
  } catch (e) {
    if (e instanceof MatchGenerationError) {
      // 한도에 걸린 것과 이용권이 없는 것은 실패가 아니다 — 이미 저장된 섹션만으로
      // 이어가되, 보여줄 것이 하나도 없으면 아래에서 다른 문구로 안내한다
      // (report/page.tsx 와 같은 처리).
      if (isMatchRateLimited(e)) rateLimited = true;
      else if (isMatchOutOfTickets(e)) outOfTickets = true;
      else console.error("[/match/[id]] 해석 생성 실패", e);
      // 일부라도 확보했으면 그것까지는 보여준다 — 이용권을 쓴 결과다.
      interpretation = e.partial;
    } else {
      // DB 오류 · DEEP_SEEK_API_KEY 누락(createMatchGenerator) 등은 여기서 삼킨다.
      console.error("[/match/[id]] 해석 확보 실패", e);
      return <MatchError />;
    }
  }
  // 보여줄 본문이 하나도 없으면 히어로도 세우지 않는다 — 이름만 떠 있는 안내 화면을
  // 만들지 않기 위해서다. 위의 로딩 fallback 과 같은 규칙이다.
  if (Object.keys(interpretation).length === 0) {
    if (outOfTickets) return <MatchOutOfTickets matchId={matchId} />;
    return rateLimited ? <MatchRateLimited /> : <MatchError />;
  }
  return (
    <>
      <MatchHero view={hero} />
      <MatchBody interpretation={interpretation} relation={ctx.relation} />
    </>
  );
}
