import { z } from "zod";
import { ProfileLimitError, type CreateProfileInput } from "@/lib/profiles/store";
import { createProfileSchema, type CreateProfileBody } from "@/lib/profiles/input";
import { isValidDraftToken } from "@/lib/drafts/store";

/**
 * 본문은 CreateProfileBody 에 한 비트를 더한 것이다.
 *
 * saved 를 createProfileSchema 자체에 넣지 않는 이유: 그 스키마의 모양은 Redis 에
 * 들어가는 드래프트의 모양이기도 하다(drafts/store.ts). "저장할까?" 는 이 라우트의
 * 질문이지 저장되는 값이 아니라서, 스키마를 공유하는 쪽까지 끌고 들어가면 퍼널·
 * 드래프트·프로필 세 곳이 뜻 없는 필드를 하나씩 나눠 갖게 된다.
 */
const bodySchema = createProfileSchema.extend({
  /** false 면 kind='temp' — 이번 궁합에만 쓰이고 목록에는 서지 않는다. */
  saved: z.boolean().default(true),
});

export interface HandlerDeps {
  /** 세션이 없으면 null */
  userId: string | null;
  create: (userId: string, input: CreateProfileInput) => Promise<{ id: string }>;
  /** 로그인 전 입력을 임시로 맡아둔다 */
  saveDraft: (token: string, body: CreateProfileBody) => Promise<void>;
  newToken: () => string;
  /** 요청에 실려온 draft 쿠키. 있으면 그 자리에 덮어쓴다 */
  existingToken: string | null;
  /** 로그인 상태에서 남은 드래프트를 정리한다 (limit 으로 남았다가 다시 만든 경우 등) */
  dropDraft: (token: string) => Promise<void>;
  /** "나" 가 아직 없으면 이 프로필로 정한다. 이미 있으면 아무 일도 하지 않는다. */
  setPrimaryIfUnset: (userId: string, profileId: string) => Promise<void>;
}

export interface HandlerResult {
  status: number;
  body: { id: string } | Record<string, never> | { error: string };
  /** 있으면 라우트가 쿠키를 굽는다 */
  draftToken?: string;
  /** 있으면 라우트가 draft 쿠키를 지운다. draftToken(굽는 신호)과 헷갈리지 않게 이름을 가른다 */
  clearDraftCookie?: boolean;
}

export async function handleCreateProfile(
  raw: unknown,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "입력을 확인해 주세요" } };

  const { saved, ...d } = parsed.data;
  // 서로 어긋난 조합은 여기서 정리한다 — 어긋난 값이 DB 든 Redis 든 남으면
  // 나중에 어느 쪽이 진실인지 알 수 없다. 두 갈래가 같은 값을 받게 검증 뒤에 둔다.
  const body: CreateProfileBody = {
    ...d,
    time: d.timeKnown ? d.time : null,
    isLeapMonth: d.calendar === "lunar" ? d.isLeapMonth : false,
  };

  // 주인이 아직 없다. 값은 Redis 가 갖고 손잡이만 쿠키로 돌려준다.
  //
  // saved 는 여기서 버린다 — 로그인 전 입력은 퍼널뿐이고, 퍼널은 내 사주를 남기려고
  // 걸어온 길이라 "저장 안 함" 이라는 선택지가 없다. 승격은 늘 'self' 다.
  // 202 는 에러가 아니라 "받았고, 주인이 정해지면 확정한다"는 뜻이다.
  if (!deps.userId) {
    // 쿠키 값이 그대로 Redis 키가 된다 — 형식이 깨졌으면 쓰레기 키를 만들지 않고
    // 새로 발급한다. 에러가 아니라 정상 갈래다.
    const reusable =
      deps.existingToken && isValidDraftToken(deps.existingToken) ? deps.existingToken : null;
    const token = reusable ?? deps.newToken();
    await deps.saveDraft(token, body);
    return { status: 202, body: {}, draftToken: token };
  }

  try {
    // 저장하지 않기로 했으면 'temp': 행은 만들되(궁합이 subject 로 참조한다)
    // 목록에는 서지 않는다.
    const { id } = await deps.create(deps.userId, { ...body, kind: saved ? "saved" : "temp" });

    // 계정의 첫 저장 프로필이 "나" 가 된다 — 퍼널을 끝까지 걸어온 사람이 넣는 것이
    // 자기 사주이기 때문이다. 이미 정해져 있으면 이 호출은 아무 일도 하지 않는다.
    // temp 는 후보가 아니다: 이번 한 번만 쓰겠다고 한 사람을 나로 삼을 수 없다.
    //
    // 실패해도 201 을 뒤집지 않는다 — 프로필은 이미 만들어졌고, "나" 는 소비하는
    // 쪽이 null 일 때 가장 오래된 저장 프로필로 물러선다.
    if (saved) {
      try {
        await deps.setPrimaryIfUnset(deps.userId, id);
      } catch (e) {
        console.error("[handleCreateProfile] setPrimaryIfUnset", e instanceof Error ? e.message : e);
      }
    }

    if (!deps.existingToken) return { status: 201, body: { id } };

    // limit 으로 남겨둔 드래프트가 있는 채로 다시 저장하면, 안 지우는 경우 다음
    // 로그인에 한 번 더 승격돼 중복 프로필이 생긴다. 프로필은 이미 만들어졌으므로
    // 정리가 실패해도 201은 그대로 돌려준다.
    try {
      await deps.dropDraft(deps.existingToken);
    } catch (e) {
      console.error("[handleCreateProfile] dropDraft", e instanceof Error ? e.message : e);
    }
    return { status: 201, body: { id }, clearDraftCookie: true };
  } catch (e) {
    // 한도 초과는 클라이언트가 분기해야 하는 정상 응답이다. 나머지는 500 으로 흘린다.
    if (e instanceof ProfileLimitError) return { status: 409, body: { error: "limit" } };
    throw e;
  }
}
