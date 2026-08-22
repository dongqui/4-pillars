import { z } from "zod";
import { createProfileSchema } from "@/lib/profiles/input";
import { relationInputSchema } from "@/lib/matches/relation-types";
import type { CreateMatchInput } from "@/lib/matches/store";
import type { MatchAccess } from "@/lib/matches/access";
import { CounterpartLimitError, type CreateProfileInput } from "@/lib/profiles/store";
import { parseProfileParam } from "@/lib/profiles/param";

const bodySchema = z.object({
  subjectProfileId: z.string(),
  counterpartProfileId: z.string().optional(),
  // 즉석 입력. kind 는 서버가 정한다 — 클라이언트가 본문에 심은 값은 무시된다.
  counterpart: createProfileSchema.optional(),
  /**
   * 이 상대를 다음에도 목록에서 고를 수 있게 둘 것인가 — 입력 폼의
   * "이 사람 프로필 저장하기" 체크박스다. counterpart 와 같이 올 때만 뜻이 있다.
   *
   * kind 안에 섞어 보내게 하지 않고 형제 필드로 둔다: kind 는 서버만 정한다는
   * 규칙을 그대로 두면서, 이 한 비트는 사용자의 선택이라 받아도 잃을 게 없다
   * (숨기는 방향으로만 작동한다). 기본값이 true 라 이 값을 모르는 옛 클라이언트도
   * 상대를 조용히 잃지 않는다.
   */
  saveCounterpart: z.boolean().default(true),
  relation: relationInputSchema,
});

export interface CreateMatchDeps {
  userId: string | null;
  checkAccess(userId: string | null): Promise<MatchAccess>;
  getProfile(userId: string, id: string): Promise<{ id: string } | null>;
  createProfile(userId: string, input: CreateProfileInput): Promise<{ id: string }>;
  findOrCreate(userId: string, input: CreateMatchInput): Promise<{ id: string; created: boolean }>;
}

export interface CreateMatchResult {
  status: number;
  body: { matchId: string } | { error: string };
}

// insufficient_tickets 는 402 — 차감 API(tickets/spend)가 잔액 부족에 쓰는 코드와 같다.
// rate_limited(429)와 갈라야 한다: 한도는 기다리면 풀리지만 잔액 부족은 충전이 필요하다.
const ACCESS_STATUS = { unauthenticated: 401, rate_limited: 429, insufficient_tickets: 402 } as const;
const ACCESS_MESSAGE = {
  unauthenticated: "로그인이 필요합니다",
  rate_limited: "잠시 후 다시 시도해 주세요",
  insufficient_tickets: "이용권이 부족해요",
} as const;

export async function handleCreateMatch(
  raw: unknown,
  d: CreateMatchDeps,
): Promise<CreateMatchResult> {
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "요청을 확인해 주세요" } };

  const { subjectProfileId, counterpartProfileId, counterpart, saveCounterpart, relation } =
    parsed.data;

  // 둘 다 오면 어느 쪽을 쓸지 서버가 짐작해야 한다. 짐작은 나중에 반드시 틀린다.
  if ((counterpartProfileId === undefined) === (counterpart === undefined)) {
    return { status: 400, body: { error: "요청을 확인해 주세요" } };
  }

  const subjectParam = parseProfileParam({ profile: subjectProfileId });
  if (subjectParam.kind !== "id") return { status: 400, body: { error: "요청을 확인해 주세요" } };

  const access = await d.checkAccess(d.userId);
  if (!access.ok) {
    return { status: ACCESS_STATUS[access.reason], body: { error: ACCESS_MESSAGE[access.reason] } };
  }
  // access.ok 가 true 면 userId 는 non-null 이지만 타입은 그걸 모른다.
  const userId = d.userId as string;

  const subject = await d.getProfile(userId, subjectParam.id);
  // 없는 프로필과 남의 프로필을 구분하지 않는다 — 구분하면 id 로 존재 여부를 훑을 수 있다.
  if (subject === null) return { status: 404, body: { error: "프로필을 찾을 수 없습니다" } };

  let counterpartId: string;
  if (counterpartProfileId !== undefined) {
    const param = parseProfileParam({ profile: counterpartProfileId });
    if (param.kind !== "id") return { status: 400, body: { error: "요청을 확인해 주세요" } };
    const found = await d.getProfile(userId, param.id);
    if (found === null) return { status: 404, body: { error: "프로필을 찾을 수 없습니다" } };
    counterpartId = found.id;
  } else {
    // 저장하지 않기로 했으면 'temp' — 어느 목록에도 서지 않는다. 그래도 행은
    // 만든다: matches 가 counterpart_profile_id 로 이 행을 참조하므로 없앨 수 없다.
    //
    // 저장하기로 했으면 'saved' 다 — 홈 목록에도 서고 다음 궁합의 "나" 칸에서도
    // 고를 수 있다. 어느 문으로 들어왔는지는 더 이상 기록하지 않는다: 같은 사람을
    // 문에 따라 다르게 대할 이유가 없고, "누가 나인가" 는 users 가 따로 안다.
    try {
      const created = await d.createProfile(userId, {
        ...counterpart!,
        kind: saveCounterpart ? "saved" : "temp",
      });
      counterpartId = created.id;
    } catch (e) {
      // 상한은 예견된 상태다 — 500 으로 흘리면 "서버 오류" 라는 엉뚱한 안내가 나간다.
      if (e instanceof CounterpartLimitError) {
        return { status: 409, body: { error: e.message } };
      }
      throw e;
    }
  }

  // 자기 자신과의 궁합은 계산은 되지만 서술이 성립하지 않는다.
  if (subject.id === counterpartId) {
    return { status: 400, body: { error: "다른 사람을 선택해 주세요" } };
  }

  const match = await d.findOrCreate(userId, {
    subjectProfileId: subject.id,
    counterpartProfileId: counterpartId,
    relation,
  });

  return { status: 200, body: { matchId: match.id } };
}
