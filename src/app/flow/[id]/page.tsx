import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { analyze } from "@/lib/saju-core";
import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/users";
import { resolveDisplayName } from "@/lib/auth/display-name";
import { getFlow, type FlowRow } from "@/lib/flows/store";
import { getProfile, type ProfileRow } from "@/lib/profiles/store";
import { toBirthInput } from "@/lib/profiles/to-birth-input";
import { FLOW_SECTION_KEYS, type FlowInterpretation } from "@/app/api/flows/_lib/sections";
import { buildFlowContext, type FlowContext } from "@/app/api/flows/_lib/prompt";
import { createFlowGenerator } from "@/app/api/flows/_lib/generator";
import {
  chargeFlowGeneration,
  gateFlowGeneration,
  isFlowOutOfTickets,
  isFlowRateLimited,
} from "@/app/api/flows/_lib/gated-generator";
import { FlowGenerationError, produceFlowSections } from "@/app/api/flows/_lib/produce";
import { hasAnyFlowSections, putFlowSections } from "@/app/api/flows/_lib/store";
import { createFlowReportTransport, generateFlowReportV2 } from "@/app/api/flows/_lib/v2/generator";
import { toPublicFlowReportV2 } from "@/app/api/flows/_lib/v2/presentation";
import { flowReportV2Schema } from "@/app/api/flows/_lib/v2/schema";
import type { FlowGenerationInput } from "@/app/api/flows/_lib/v2/input";
import { MODEL } from "@/app/api/saju/_lib/generator";
import { careerTitle } from "@/lib/flows/context";
import { checkFlowLimit } from "@/lib/flows/rate-limit";
import {
  admitRevision,
  failRevision,
  findLatestRevision,
  findPendingRevision,
  getActiveRevision,
  publishRevision,
  type FlowRevisionRow,
} from "@/lib/flows/revisions";
import { spendTicket } from "@/lib/tickets/spend";
import { currentMonthIndex } from "./_lib/current-month";
import { toFlowView } from "./_lib/to-flow-view";
import { resolveFlowRoute } from "./_lib/resolve-flow-route";
import { runFlowReportV2 } from "./_lib/run-flow-report-v2";
import { FlowChrome, FlowShell } from "./_components/FlowShell";
import { FlowHero } from "./_components/FlowHero";
import { FlowHeroV2 } from "./_components/FlowHeroV2";
import { FlowBody, type FlowMissingReason } from "./_components/FlowBody";
import { FlowBodyV2 } from "./_components/FlowBodyV2";
import { AnalyzingFlow } from "./_components/AnalyzingFlow";
import { FlowError } from "./_components/FlowError";
import { FlowErrorV2 } from "./_components/FlowErrorV2";
import { FlowRateLimited } from "./_components/FlowRateLimited";
import { FlowOutOfTickets } from "./_components/FlowOutOfTickets";

/**
 * 흐름 하나가 8섹션을 한 번에 생성하고, 그중 07 은 12개월을 한 응답에 담는다 —
 * 궁합(5섹션)보다 무거워 같은 여유를 둔다.
 */
export const maxDuration = 60;

export default async function FlowResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/flow/${id}`);

  // ⚠️ getFlow 가 user_id 를 WHERE 에 건다. id 만으로 찾으면 남의 흐름이 열린다.
  const flow = await getFlow(session.userId, id);
  if (!flow) notFound();

  const [profile, user] = await Promise.all([
    getProfile(session.userId, flow.profileId),
    getUser(session.userId),
  ]);
  if (!profile) notFound();
  const displayName = resolveDisplayName(user);

  const now = new Date();
  // 선택한 해가 지금의 명리 연도가 아니면 null 이다 — 강조할 "지금" 이 없다.
  const currentIndex = currentMonthIndex(flow.months, now);

  // 플래그는 입력이 아니다 — 발행본 읽기·pending 완료·failed 재시도는 플래그를
  // 안 본다(resolveFlowRoute 의 문서 그대로). 한 번만 읽어 분기를 정한다.
  const [active, pending, latest, hasV1] = await Promise.all([
    getActiveRevision(flow.id),
    findPendingRevision(flow.id),
    findLatestRevision(flow.id),
    hasAnyFlowSections(flow.id),
  ]);
  const route = resolveFlowRoute({ active, hasV1Sections: hasV1, pending, latest });

  if (route === "v2:published") {
    return (
      <FlowShell displayName={displayName}>
        <FlowV2Published
          flow={flow}
          revision={active!}
          profileName={profile.name}
          profileId={flow.profileId}
          currentIndex={currentIndex}
        />
      </FlowShell>
    );
  }

  if (route === "v2:failed") {
    return (
      <FlowShell displayName={displayName}>
        <FlowChrome flow={flow} profileName={profile.name}>
          <FlowErrorV2 flowId={flow.id} />
        </FlowChrome>
      </FlowShell>
    );
  }

  if (route === "v2:generate") {
    return (
      <FlowShell displayName={displayName}>
        {/* pending!.id — resolveFlowRoute 가 "v2:generate" 를 돌려줬다는 것은
            pending 이 존재한다는 뜻이다(그 판정 자체가 s.pending 을 본다). */}
        <Suspense fallback={<AnalyzingFlow message="선택한 해의 운세를 정리하고 있어요." />}>
          <FlowV2Generate
            flow={flow}
            userId={session.userId}
            profileName={profile.name}
            profileId={flow.profileId}
            currentIndex={currentIndex}
            pendingId={pending!.id}
          />
        </Suspense>
      </FlowShell>
    );
  }

  // route === "v1" — 기존 코드 그대로.
  const ctx = buildContext(profile, flow);
  // 계산이 깨지면 서술을 만들 재료가 없다 — 껍데기만 남기고 안내로 끝낸다
  // (match/[id]/page.tsx 의 analyzePair 와 같은 처리).
  if (!ctx) {
    return (
      <FlowShell displayName={displayName}>
        <FlowChrome flow={flow} profileName={profile.name}>
          <FlowError />
        </FlowChrome>
      </FlowShell>
    );
  }

  return (
    <FlowShell displayName={displayName}>
      {/* 로딩 중에는 스피너만 보인다 — 위치 요약과 하단 링크는 FlowChrome 에 있어
          FlowSections 가 도착해야 함께 그려진다(FlowShell 의 주석 참고). */}
      <Suspense fallback={<AnalyzingFlow />}>
        <FlowSections
          flow={flow}
          userId={session.userId}
          ctx={ctx}
          currentIndex={currentIndex}
          profileName={profile.name}
        />
      </Suspense>
    </FlowShell>
  );
}

/**
 * 발행된 v2 리포트. 페이지가 직접(route==="v2:published") 부르기도 하고,
 * FlowV2Generate 가 방금 발행한 결과를 같은 모양으로 보여주려고 다시 부르기도
 * 한다 — 그래서 여기서 FlowChrome 까지 감싼다(page.tsx 쪽에서 chrome()을 또
 * 씌우지 않는다).
 *
 * publishedPayload 는 DB 에 저장된 뒤의 값이라 이론상 깨질 수 있다(스키마 변경,
 * 수동 편집 등) — safeParse 가 실패하면 저장본이 깨진 것으로 보고 FlowError.
 */
function FlowV2Published({
  flow,
  revision,
  profileName,
  profileId,
  currentIndex,
}: {
  flow: FlowRow;
  revision: FlowRevisionRow;
  profileName: string;
  profileId: string;
  currentIndex: number | null;
}) {
  const parsed = flowReportV2Schema.safeParse(revision.publishedPayload);
  if (!parsed.success) {
    console.error("[/flow/[id]] v2 저장본 파싱 실패", revision.id);
    return (
      <FlowChrome flow={flow} profileName={profileName}>
        <FlowError />
      </FlowChrome>
    );
  }

  const contextSnapshot = revision.contextSnapshot;
  const report = toPublicFlowReportV2(parsed.data, {
    careerTitle: careerTitle(contextSnapshot.career),
    reference: contextSnapshot.reference,
  });

  return (
    <FlowChrome flow={flow} profileName={profileName}>
      <FlowHeroV2 headline={report.sections.overview.headline} flowYear={flow.flowYear} />
      <FlowBodyV2
        report={report}
        months={revision.monthsSnapshot}
        currentIndex={currentIndex}
        profileId={profileId}
      />
    </FlowChrome>
  );
}

/**
 * v2 pending revision 을 실제로 만든다(runFlowReportV2). MatchSections·
 * FlowSections 와 같은 이유로 <Suspense> 안, try 안에서 transport 를 만든다 —
 * DEEP_SEEK_API_KEY 미설정 같은 구성 실패가 여기서 나면 catch 가 잡아
 * <FlowError /> 를 보여준다.
 */
async function FlowV2Generate({
  flow,
  userId,
  profileName,
  profileId,
  currentIndex,
  pendingId,
}: {
  flow: FlowRow;
  userId: string;
  profileName: string;
  profileId: string;
  currentIndex: number | null;
  pendingId: string;
}) {
  const chrome = (inner: React.ReactNode) => (
    <FlowChrome flow={flow} profileName={profileName}>
      {inner}
    </FlowChrome>
  );

  try {
    const transport = createFlowReportTransport();
    const out = await runFlowReportV2(userId, flow.id, pendingId, {
      checkLimit: checkFlowLimit,
      spend: spendTicket,
      admit: admitRevision,
      generate: (i: FlowGenerationInput) => generateFlowReportV2(i, transport),
      publish: publishRevision,
      fail: failRevision,
      getActive: getActiveRevision,
      model: MODEL,
    });

    switch (out.kind) {
      case "rate_limited":
        return chrome(<FlowRateLimited />);
      case "out_of_tickets":
        return chrome(<FlowOutOfTickets flowId={flow.id} />);
      case "failed":
        return chrome(<FlowErrorV2 flowId={flow.id} />);
      case "published":
        return (
          <FlowV2Published
            flow={flow}
            revision={out.revision}
            profileName={profileName}
            profileId={profileId}
            currentIndex={currentIndex}
          />
        );
    }
  } catch (e) {
    // message 에는 모델 응답·요청 본문이 실릴 수 있다 — 이름만 남긴다.
    console.error("[/flow/[id]] v2 생성 실패", e instanceof Error ? e.name : "unknown");
    return chrome(<FlowError />);
  }
}

/**
 * 원국 계산은 던질 수 있다. createProfileSchema 가 year 2200 · day 31 까지 받으므로
 * API 로 만든 프로필은 퍼널로는 나올 수 없는 날짜를 들고 있을 수 있다.
 *
 * 던지게 두지 않는 이유는 match/[id]/page.tsx 의 analyzePair 와 같다: src/app
 * 아래에 error.tsx 가 하나도 없어 잡히지 않은 예외는 헤더도 출구도 없는 Next
 * 기본 에러 화면이 된다. createFlowGenerator() 를 <Suspense>/try 안으로 옮긴
 * 것과 같은 이유로, 이쪽도 페이지 본문(<FlowShell> 밖)에서 그냥 부르면 안 된다.
 */
function buildContext(profile: ProfileRow, flow: FlowRow): FlowContext | null {
  try {
    const analysis = analyze(toBirthInput(profile));
    return buildFlowContext(analysis, flow.flowYear, flow.months);
  } catch (e) {
    console.error("[/flow/[id]] 원국 계산 실패", e);
    return null;
  }
}

/**
 * 느린 자리는 여기뿐이다 — MatchSections 와 같은 이유로 <Suspense> 안, try 안에서
 * 생성기를 만든다: DEEP_SEEK_API_KEY 미설정 같은 생성기 구성 실패가 여기서 나면
 * catch 가 잡아 FlowShell 아래에 <FlowError /> 를 보여준다. try 바깥에서 만들면
 * (report/page.tsx 가 겪은 문제) Next 의 기본 에러 화면으로 떨어진다.
 *
 * FlowHero 도 이 안에서 함께 낸다 — 대표 문장이 01(overview) 섹션의 LLM 서술에서
 * 나와 MatchHero 처럼 계산값만으로 <Suspense> 밖에 둘 수 없다.
 */
async function FlowSections({
  flow,
  userId,
  ctx,
  currentIndex,
  profileName,
}: {
  flow: FlowRow;
  userId: string;
  ctx: FlowContext;
  currentIndex: number | null;
  profileName: string;
}) {
  const chrome = (inner: React.ReactNode) => (
    <FlowChrome flow={flow} profileName={profileName}>
      {inner}
    </FlowChrome>
  );
  let interpretation: Partial<FlowInterpretation>;
  let rateLimited = false;
  let outOfTickets = false;

  try {
    // 한도는 여기, 생성기를 감싸서 씌운다. produceFlowSections 는 저장소에 없는
    // 섹션이 있을 때만 생성기를 부르므로 이미 다 저장된 흐름을 다시 여는 것은
    // 세지 않는다. 이용권도 같은 자리다.
    //
    // 합성 순서: gateFlowGeneration 이 바깥, chargeFlowGeneration 이 안쪽이다
    // (gated-generator.ts 의 chargeFlowGeneration 문서 그대로) — 한도 확인이
    // 이용권 차감보다 먼저 일어나야 한도에 걸린 요청이 이용권을 쓰지 않는다.
    // 반대로 감싸면 이용권부터 깎고 나서야 한도 초과를 알게 되어, 막아야 할
    // 요청에서 먼저 돈을 받는 꼴이 된다.
    //
    // client 를 생략하면 store.ts 의 실제 sql 이 쓰인다 — 테스트만 가짜를 준다.
    ({ interpretation } = await produceFlowSections(flow.id, ctx, {
      generator: gateFlowGeneration(
        chargeFlowGeneration(createFlowGenerator(), userId, flow.id),
        userId,
      ),
      putStored: putFlowSections,
      sectionKeys: FLOW_SECTION_KEYS,
    }));
  } catch (e) {
    if (e instanceof FlowGenerationError) {
      // 한도에 걸린 것과 이용권이 없는 것은 실패가 아니다 — 이미 저장된 섹션만으로
      // 이어가되, 보여줄 것이 하나도 없으면 아래에서 다른 문구로 안내한다.
      if (isFlowRateLimited(e)) rateLimited = true;
      else if (isFlowOutOfTickets(e)) outOfTickets = true;
      else console.error("[/flow/[id]] 해석 생성 실패", e);
      // 일부라도 확보했으면 그것까지는 보여준다 — 이용권을 쓴 결과다.
      interpretation = e.partial;
    } else {
      // DB 오류 · DEEP_SEEK_API_KEY 누락(createFlowGenerator) 등은 여기서 삼킨다.
      console.error("[/flow/[id]] 해석 확보 실패", e);
      return chrome(<FlowError />);
    }
  }

  if (Object.keys(interpretation).length === 0) {
    if (outOfTickets) return chrome(<FlowOutOfTickets flowId={flow.id} />);
    return chrome(rateLimited ? <FlowRateLimited /> : <FlowError />);
  }

  // 일부만 확보한 경우에도 이 두 플래그를 살려 화면까지 내린다. 예전에는 바로 위
  // "하나도 없을 때" 분기에서만 읽고 버렸다 — 그래서 다섯은 있고 넷이 한도에 막혔을
  // 때 그 네 자리가 "새로고침하면 다시 만들어요" 라고 말했다. 새로고침은 한도만 한
  // 칸 더 먹고 같은 화면을 돌려준다.
  const missingReason: FlowMissingReason = rateLimited
    ? "rate-limit"
    : outOfTickets
      ? "tickets"
      : "failed";

  const sections = toFlowView(interpretation);
  return chrome(
    <>
      <FlowHero sections={sections} flowYear={flow.flowYear} />
      <FlowBody
        sections={sections}
        months={flow.months}
        currentIndex={currentIndex}
        profileId={flow.profileId}
        flowYear={flow.flowYear}
        missingReason={missingReason}
      />
    </>,
  );
}
