import { z } from "zod";
import { analyze, flowYearAt, flowYearOf, type SajuAnalysis } from "@/lib/saju-core";
import type { FlowAccess } from "@/lib/flows/access";
import type { CreateFlowInput } from "@/lib/flows/store";
import { flowMonths } from "./pivots";

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
  checkAccess(userId: string | null): Promise<FlowAccess>;
  /** ⚠️ userId 를 함께 넘긴다. 남의 프로필로 흐름을 만들지 못하게 하는 유일한 방어선이다 */
  getProfile(userId: string, id: string): Promise<FlowProfile | null>;
  findOrCreate(
    userId: string,
    input: CreateFlowInput,
  ): Promise<{ id: string; created: boolean }>;
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

  // 태어나기 전 해에는 대운이 없다. 화면도 그 칸을 빼지만 화면을 안 거치는
  // 요청이 있어 여기서도 막는다. 태어난 해 자체는 허용한다 — 경계는 입춘이지만
  // birth.year 는 달력 연도라 여기서 더 정확히 잴 수 없고, 어긋나는 방향은
  // "막아야 할 해를 통과시킴"이 아니라 "허용해도 될 생일 해를 막음"이라
  // 사용자에게 해가 없다.
  if (year < profile.birth.year) {
    return { status: 400, body: { error: "선택할 수 없는 연도입니다" } };
  }

  const analysis: SajuAnalysis = analyze(profile.birth);
  const period = flowYearOf(year);
  // 12개월과 기간을 여기서 확정해 행에 박제한다. 임계값을 나중에 튜닝해도 이미
  // 판 흐름의 변곡점은 소급해서 바뀌지 않는다.
  const months = flowMonths(analysis, year);

  const { id, created } = await deps.findOrCreate(userId, {
    profileId: profile.id,
    flowYear: year,
    periodStart: period.start,
    periodEnd: period.end,
    months,
  });

  return { status: created ? 201 : 200, body: { id } };
}
