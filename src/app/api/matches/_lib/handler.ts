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
  // 즉석 입력. kind 는 서버가 정한다 — 클라이언트가 'self' 를 보내
  // 남의 생년월일을 내 목록에 밀어 넣지 못하게 한다.
  counterpart: createProfileSchema.optional(),
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

const ACCESS_STATUS = { unauthenticated: 401, rate_limited: 429 } as const;
const ACCESS_MESSAGE = {
  unauthenticated: "로그인이 필요합니다",
  rate_limited: "잠시 후 다시 시도해 주세요",
} as const;

export async function handleCreateMatch(
  raw: unknown,
  d: CreateMatchDeps,
): Promise<CreateMatchResult> {
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "요청을 확인해 주세요" } };

  const { subjectProfileId, counterpartProfileId, counterpart, relation } = parsed.data;

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
    // kind 는 항상 'other' 다. 내 목록으로 올리는 건 결과 화면의 저장 모달이 한다.
    try {
      const created = await d.createProfile(userId, { ...counterpart!, kind: "other" });
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
