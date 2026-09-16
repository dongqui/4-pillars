import { z } from "zod";
import { analyze, flowYearAt, flowYearOf, type SajuAnalysis } from "@/lib/saju-core";
import type { FlowAccess } from "@/lib/flows/access";
import { contextAnswerSchema, normalizeFlowContext, yearRelationOf } from "@/lib/flows/context";
import { requestHashOf } from "@/lib/flows/request-hash";
import type { PendingRevisionInput, UpsertResult } from "@/lib/flows/revisions";
import type { CreateFlowInput, FlowRow } from "@/lib/flows/store";
import { sajuBirthYearOf } from "@/lib/flows/birth-year";
import { flowMonths } from "./pivots";
import { buildFlowEvidence, FLOW_CALC_VERSION } from "./v2/facts";
import { buildFlowGenerationInput } from "./v2/input";
import { PROMPT_BUNDLE_VERSION } from "./v2/prompts";

/** 현재 명리 연도에서 앞뒤로 몇 년까지 고를 수 있는가. 화면의 연도 칸 수와 같은 출처다. */
export const FLOW_YEAR_SPAN = 5;

/**
 * 고를 수 있는 연도의 경계.
 *
 * 서버가 다시 재는 이유는 화면을 못 믿어서가 아니라, 화면을 거치지 않는 요청이
 * 있기 때문이다 — 범위 밖 연도는 절기 계산의 검증 범위 밖이기도 하다.
 */
export function flowYearRange(now: Date): { min: number; max: number } {
  const current = flowYearAt(now).year;
  return { min: current - FLOW_YEAR_SPAN, max: current + FLOW_YEAR_SPAN };
}

const Input = z
  .object({
    profileId: z.string().min(1),
    // 기본값을 두지 않는다 — 지금으로 조용히 물러서면 사용자가 고른 해와 사는
    // 해가 갈린다. 이용권이 걸린 요청에서 가장 나쁜 실패다.
    year: z.number().int(),
    context: contextAnswerSchema.optional(),
  })
  .strict();

/** getProfile 이 돌려주는 것 중 이 핸들러가 실제로 읽는 필드만. */
export interface FlowProfile {
  id: string;
  birth: Parameters<typeof analyze>[0];
}

export interface CreateFlowDeps {
  userId: string | null;
  /** 현재 시각을 주입한다 — 서버 시계를 읽으면 연도 범위를 테스트로 못 박을 수 없다 */
  now: Date;
  /** 새 진입만 가린다 — v2-flag.ts 참고. 발행본 읽기·pending 완료·재시도는 이 값을 안 본다 */
  v2Enabled: boolean;
  checkAccess(userId: string | null): Promise<FlowAccess>;
  /** ⚠️ userId 를 함께 넘긴다. 남의 프로필로 흐름을 만들지 못하게 하는 유일한 방어선이다 */
  getProfile(userId: string, id: string): Promise<FlowProfile | null>;
  findOrCreate(
    userId: string,
    input: CreateFlowInput,
  ): Promise<{ row: FlowRow; created: boolean }>;
  /** v1 본문(구매본)이 이미 있는 flow 인가 — 있으면 v2 pending 을 만들지 않는다 */
  hasAnyFlowSections(flowId: string): Promise<boolean>;
  upsertPendingRevision(flowId: string, input: PendingRevisionInput): Promise<UpsertResult>;
  randomUUID(): string;
}

const STATUS: Record<Exclude<FlowAccess, { ok: true }>["reason"], number> = {
  unauthenticated: 401,
  rate_limited: 429,
  insufficient_tickets: 402,
};

export async function handleCreateFlow(
  raw: unknown,
  deps: CreateFlowDeps,
): Promise<{ status: number; body: unknown }> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "요청 형식이 올바르지 않습니다" } };

  const { min, max } = flowYearRange(deps.now);
  const year = parsed.data.year;
  if (year < min || year > max) {
    return { status: 400, body: { error: "선택할 수 없는 연도입니다" } };
  }

  const access = await deps.checkAccess(deps.userId);
  if (!access.ok) {
    return { status: STATUS[access.reason], body: { error: access.reason } };
  }

  // access.ok 가 true 면 userId 는 반드시 있다 — canCreateFlow 가 null 을 먼저 막는다.
  const userId = deps.userId!;

  const profile = await deps.getProfile(userId, parsed.data.profileId);
  if (!profile) return { status: 404, body: { error: "프로필을 찾을 수 없습니다" } };

  // v2 로의 새 진입만 플래그 뒤에 둔다 — context 를 보냈다는 것이 새 진입의 신호다.
  if (!deps.v2Enabled && parsed.data.context) {
    return { status: 400, body: { error: "flow_v2_disabled" } };
  }

  const analysis: SajuAnalysis = analyze(profile.birth);

  // 태어나기 전 해에는 대운이 없다. 화면도 그 칸을 빼지만 화면을 안 거치는
  // 요청이 있어 여기서도 막는다.
  //
  // birth.year(달력 연도)와 비교하지 않는다 — 세운은 입춘에 바뀌므로 입춘 전에
  // 태어난 사람은 달력 연도보다 명리 연도가 하나 작다(예: 1990-01-15 생은
  // 명리로 1989년생). birth.year 로 비교하면 그 명리 1989년(대운 데이터가
  // 실제로 있는, 정당히 팔 수 있는 해)을 400 으로 막아 이용권을 못 쓰게 한다 —
  // sajuBirthYearOf 가 이 핸들러와 선택 화면이 같이 쓰는 계산이다.
  const birthYear = sajuBirthYearOf(analysis);
  if (year < birthYear) {
    return { status: 400, body: { error: "선택할 수 없는 연도입니다" } };
  }

  const period = flowYearOf(year);
  // 12개월과 기간을 여기서 확정해 행에 박제한다. 임계값을 나중에 튜닝해도 이미
  // 판 흐름의 변곡점은 소급해서 바뀌지 않는다.
  const months = flowMonths(analysis, year);

  const { row, created } = await deps.findOrCreate(userId, {
    profileId: profile.id,
    flowYear: year,
    periodStart: period.start,
    periodEnd: period.end,
    months,
  });

  const status = created ? 201 : 200;
  if (!deps.v2Enabled) return { status, body: { id: row.id } };

  // v1 구매본이 있는 flow — 업그레이드는 B
  if (!created && (await deps.hasAnyFlowSections(row.id))) return { status, body: { id: row.id } };

  const relation = yearRelationOf(year, deps.now);
  const snapshot = normalizeFlowContext(parsed.data.context, { relation, now: deps.now });
  // ⚠️ months 는 저장된 row.months — 새로 계산한 months 는 INSERT 에만 쓴다(스펙 §5)
  const evidence = buildFlowEvidence(analysis, year, row.months);
  const input = buildFlowGenerationInput({ flowYear: year, relation, snapshot, evidence });
  const { asOf: _asOf, ...contextForHash } = snapshot;
  void _asOf;
  const up = await deps.upsertPendingRevision(row.id, {
    promptBundleVersion: PROMPT_BUNDLE_VERSION,
    idempotencyKey: deps.randomUUID(),
    requestHash: requestHashOf({
      flowYear: year, context: contextForHash, evidence, months: row.months,
      calcVersion: FLOW_CALC_VERSION, promptBundleVersion: PROMPT_BUNDLE_VERSION,
    }),
    contextSnapshot: snapshot, inputSnapshot: input, monthsSnapshot: row.months,
  });
  if (up.kind === "busy") return { status: 409, body: { error: "flow_v2_pending_busy" } };
  return { status, body: { id: row.id } };
}
