import { ProfileLimitError, type CreateProfileInput } from "@/lib/profiles/store";
import type { CreateProfileBody } from "@/lib/profiles/input";

export type PromoteResult =
  /** 토큰 없음 / 레코드 없음 / 만료 / 스키마 불일치 — 승격할 것이 없다 */
  | { kind: "none" }
  | { kind: "promoted"; id: string }
  /** 한도 초과. 드래프트를 남겨 사용자가 자리를 비운 뒤 다시 시도할 수 있게 한다 */
  | { kind: "limit" }
  /** 그 밖의 실패. 로그인은 성공시킨다 */
  | { kind: "failed" };

export interface PromoteDeps {
  getDraft: (token: string) => Promise<CreateProfileBody | null>;
  createProfile: (userId: string, input: CreateProfileInput) => Promise<{ id: string }>;
  deleteDraft: (token: string) => Promise<void>;
}

/**
 * 익명 드래프트를 프로필 행으로 올린다.
 *
 * 절대 throw 하지 않는다 — 호출 시점에 세션 쿠키는 아직 응답에 실리지 않았고,
 * 여기서 예외가 새면 승격 실패가 로그인 실패로 번진다. 실패해도 드래프트는
 * 남으므로 다음 기회가 있다.
 */
export async function promoteDraft(
  token: string | null,
  userId: string,
  deps: PromoteDeps,
): Promise<PromoteResult> {
  if (!token) return { kind: "none" };

  try {
    const draft = await deps.getDraft(token);
    if (!draft) return { kind: "none" };

    // 드래프트 승격은 언제나 로그인한 본인의 사주를 저장한다.
    const { id } = await deps.createProfile(userId, { ...draft, kind: "self" });

    // 삭제 실패가 성공을 뒤집지 않게 따로 감싼다 — 행은 이미 생겼고,
    // 여기서 failed 를 돌려주면 쿠키가 남아 다음 로그인에 중복 프로필이 생긴다.
    try {
      await deps.deleteDraft(token);
    } catch (e) {
      console.error("[promoteDraft] deleteDraft", e instanceof Error ? e.message : e);
    }

    return { kind: "promoted", id };
  } catch (e) {
    if (e instanceof ProfileLimitError) return { kind: "limit" };
    console.error("[promoteDraft]", e instanceof Error ? e.message : e);
    return { kind: "failed" };
  }
}
