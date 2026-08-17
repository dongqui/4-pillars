import { z } from "zod";
import { FEATURE_COST, FEATURE_IDS, type Feature } from "@/lib/tickets/features";
import type { SpendResult } from "@/lib/tickets/spend";

// cost 를 받는 필드가 없는 것이 이 스키마의 요점이다 — 단가는 서버 표에서만 온다.
// feature 를 z.enum 으로 받으면 모르는 값이 여기서 400 으로 끊긴다.
const spendSchema = z.object({
  feature: z.enum(FEATURE_IDS),
  subjectKey: z.string().min(1),
});

export interface SpendDeps {
  /** 세션이 없으면 null */
  userId: string | null;
  /** feature 마다 대상 소유 규칙이 다르다. 없는 대상도 false 다. */
  ownsSubject(userId: string, feature: Feature, subjectKey: string): Promise<boolean>;
  spend(a: {
    userId: string;
    feature: Feature;
    subjectKey: string;
    cost: number;
  }): Promise<SpendResult>;
}

export interface SpendApiResult {
  status: number;
  body: { kind: SpendResult["kind"]; balance: number } | { error: string };
}

export async function handleSpend(raw: unknown, d: SpendDeps): Promise<SpendApiResult> {
  const parsed = spendSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "요청을 확인해 주세요" } };
  if (d.userId === null) return { status: 401, body: { error: "로그인이 필요합니다" } };

  const { feature, subjectKey } = parsed.data;

  // ⚠️ 소유 확인이 이 핸들러의 존재 이유다. 빼면 남의 프로필 id 에 이용권을 써서
  // 존재 여부를 훑을 수 있고, 열람 권한이 남의 사주에 붙는다.
  // 없는 대상과 남의 대상을 구분하지 않는다 — 구분하면 id 로 훑을 수 있다.
  if (!(await d.ownsSubject(d.userId, feature, subjectKey))) {
    return { status: 404, body: { error: "대상을 찾을 수 없습니다" } };
  }

  const result = await d.spend({
    userId: d.userId,
    feature,
    subjectKey,
    cost: FEATURE_COST[feature],
  });

  // 402 는 완료 API 가 미결제에 쓰는 코드와 같다 — "돈이 더 필요하다"는 뜻이 같다.
  return {
    status: result.ok ? 200 : 402,
    body: { kind: result.kind, balance: result.balance },
  };
}
