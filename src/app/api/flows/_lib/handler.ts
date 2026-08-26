import { z } from "zod";
import { analyze, flowYearAt, type SajuAnalysis } from "@/lib/saju-core";
import type { FlowAccess } from "@/lib/flows/access";
import type { CreateFlowInput } from "@/lib/flows/store";
import { flowSegments } from "./segments";

const Input = z.object({ profileId: z.string().min(1) }).strict();

/** getProfile 이 돌려주는 것 중 이 핸들러가 실제로 읽는 필드만. */
export interface FlowProfile {
  id: string;
  birth: Parameters<typeof analyze>[0];
}

export interface CreateFlowDeps {
  userId: string | null;
  /** 현재 시각을 주입한다 — 서버 시계를 읽으면 명리 연도를 테스트로 못 박을 수 없다 */
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

  const access = await deps.checkAccess(deps.userId);
  if (!access.ok) {
    return { status: STATUS[access.reason], body: { error: access.reason } };
  }

  // access.ok 가 true 면 userId 는 반드시 있다 — canCreateFlow 가 null 을 먼저 막는다.
  const userId = deps.userId!;

  const profile = await deps.getProfile(userId, parsed.data.profileId);
  if (!profile) return { status: 404, body: { error: "프로필을 찾을 수 없습니다" } };

  const analysis: SajuAnalysis = analyze(profile.birth);
  const period = flowYearAt(deps.now);
  // 구간과 기간을 여기서 확정해 행에 박제한다. 임계값을 나중에 튜닝해도 이미 판
  // 흐름의 구간은 소급해서 바뀌지 않는다.
  const segments = flowSegments(analysis, period.year);

  const { id, created } = await deps.findOrCreate(userId, {
    profileId: profile.id,
    flowYear: period.year,
    periodStart: period.start,
    periodEnd: period.end,
    segments,
  });

  return { status: created ? 201 : 200, body: { id } };
}
