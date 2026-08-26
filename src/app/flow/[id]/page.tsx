import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { analyze } from "@/lib/saju-core";
import { getSession } from "@/lib/auth/session";
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
import { getFlowSections, putFlowSections } from "@/app/api/flows/_lib/store";
import { currentSegmentIndex } from "./_lib/current-segment";
import { toFlowView } from "./_lib/to-flow-view";
import { FlowShell } from "./_components/FlowShell";
import { FlowHero } from "./_components/FlowHero";
import { FlowBody } from "./_components/FlowBody";
import { AnalyzingFlow } from "./_components/AnalyzingFlow";
import { FlowError } from "./_components/FlowError";
import { FlowRateLimited } from "./_components/FlowRateLimited";
import { FlowOutOfTickets } from "./_components/FlowOutOfTickets";

/**
 * 흐름 하나가 최대 8섹션 × 최대 3구간을 한 번에 생성할 수 있다 — 궁합(5섹션)보다
 * 무거워 같은 여유를 둔다.
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

  const profile = await getProfile(session.userId, flow.profileId);
  if (!profile) notFound();

  // 한 번만 잰다 — FlowShell 도 같은 시각을 써야 "지금 몇 번째 구간인가" 와
  // "이 흐름이 지났는가" 가 서로 다른 순간을 기준으로 어긋나지 않는다.
  const now = new Date();
  const index = currentSegmentIndex(flow.segments, now);

  const ctx = buildContext(profile, flow);
  // 계산이 깨지면 서술을 만들 재료가 없다 — 껍데기만 남기고 안내로 끝낸다
  // (match/[id]/page.tsx 의 analyzePair 와 같은 처리).
  if (!ctx) {
    return (
      <FlowShell flow={flow} index={index} now={now}>
        <FlowError />
      </FlowShell>
    );
  }

  return (
    <FlowShell flow={flow} index={index} now={now}>
      <Suspense fallback={<AnalyzingFlow />}>
        <FlowSections flow={flow} userId={session.userId} ctx={ctx} index={index} />
      </Suspense>
    </FlowShell>
  );
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
    return buildFlowContext(analysis, flow.flowYear, flow.segments);
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
 * FlowHero 도 이 안에서 함께 낸다 — 대표 문장이 01(now) 섹션의 LLM 서술에서 나와
 * MatchHero 처럼 계산값만으로 <Suspense> 밖에 둘 수 없다.
 */
async function FlowSections({
  flow,
  userId,
  ctx,
  index,
}: {
  flow: FlowRow;
  userId: string;
  ctx: FlowContext;
  index: number;
}) {
  let interpretation: Partial<FlowInterpretation>;
  let rateLimited = false;
  let outOfTickets = false;
  const n = flow.segments.length;

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
    ({ interpretation } = await produceFlowSections(flow.id, ctx, {
      generator: gateFlowGeneration(
        chargeFlowGeneration(createFlowGenerator(), userId, flow.id),
        userId,
      ),
      getStored: (flowId, keys) => getFlowSections(flowId, keys, n),
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
      return <FlowError />;
    }
  }

  if (Object.keys(interpretation).length === 0) {
    if (outOfTickets) return <FlowOutOfTickets flowId={flow.id} />;
    return rateLimited ? <FlowRateLimited /> : <FlowError />;
  }

  const sections = toFlowView(interpretation, index);
  return (
    <>
      <FlowHero sections={sections} />
      <FlowBody sections={sections} segments={flow.segments} profileId={flow.profileId} />
    </>
  );
}
