import { parseProfileParam } from "@/lib/profiles/param";

export interface PromoteDeps {
  userId: string | null;
  promote(userId: string, id: string): Promise<boolean>;
}

export interface PromoteResult {
  status: number;
  body: { promoted: boolean } | { error: string };
}

/**
 * 궁합 상대를 내 사주 목록으로 올린다.
 *
 * 이미 'self' 인 경우를 에러로 두지 않는다 — 사용자가 같은 버튼을 두 번 눌렀거나
 * 다른 탭에서 이미 저장한 경우인데, 둘 다 실패가 아니다.
 */
export async function handlePromote(id: string, d: PromoteDeps): Promise<PromoteResult> {
  if (d.userId === null) return { status: 401, body: { error: "로그인이 필요합니다" } };
  const param = parseProfileParam({ profile: id });
  if (param.kind !== "id") return { status: 400, body: { error: "요청을 확인해 주세요" } };
  return { status: 200, body: { promoted: await d.promote(d.userId, param.id) } };
}
