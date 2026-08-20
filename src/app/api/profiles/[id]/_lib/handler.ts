import { parseProfileParam } from "@/lib/profiles/param";

export interface DeleteProfileDeps {
  /** 세션이 없으면 null */
  userId: string | null;
  /** 지운 행이 있으면 true. user_id 를 함께 거르는 것은 store 의 책임이다 */
  remove(userId: string, id: string): Promise<boolean>;
}

export interface DeleteProfileResult {
  status: number;
  body: { deleted: true } | { error: string };
}

/**
 * 내 사주 하나를 지운다.
 *
 * 없는 프로필과 남의 프로필을 404 로 합친다 — 401/404 를 가르면 id 를 하나씩
 * 올려가며 어느 번호가 존재하는지 훑을 수 있다(getProfile 이 notFound 로 합치는
 * 것과 같은 이유).
 *
 * 이미 지워진 프로필에 한 번 더 오는 경우(같은 버튼 두 번, 다른 탭에서 먼저 지움)도
 * 404 다. handlePromote 처럼 "할 일 없음"으로 접지 않는 이유: 승격은 결과 상태가
 * 같지만, 삭제는 화면이 이미 사라진 프로필을 붙들고 있다는 뜻이라 새로고침이 답이다.
 */
export async function handleDeleteProfile(
  id: string,
  d: DeleteProfileDeps,
): Promise<DeleteProfileResult> {
  if (d.userId === null) return { status: 401, body: { error: "로그인이 필요합니다" } };
  // URL 문자열을 그대로 ::bigint 로 캐스팅하면 DB 에러 → 500 이다.
  const param = parseProfileParam({ profile: id });
  if (param.kind !== "id") return { status: 400, body: { error: "요청을 확인해 주세요" } };

  if (!(await d.remove(d.userId, param.id))) {
    return { status: 404, body: { error: "프로필을 찾을 수 없습니다" } };
  }
  return { status: 200, body: { deleted: true } };
}
