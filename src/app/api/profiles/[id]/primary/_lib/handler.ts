import { parseProfileParam } from "@/lib/profiles/param";

export interface SetPrimaryDeps {
  /** 세션이 없으면 null */
  userId: string | null;
  /** 정해졌으면 true. 소유권과 kind='saved' 는 store 의 WHERE 절이 본다 */
  setPrimary(userId: string, id: string): Promise<boolean>;
}

export interface SetPrimaryResult {
  status: number;
  body: { primary: true } | { error: string };
}

/**
 * 홈에서 고른 프로필을 계정의 "나" 로 정한다.
 *
 * 없는 프로필 · 남의 프로필 · 목록에 서지 않는 temp 를 404 하나로 합친다 —
 * 401/404 를 가르면 id 를 하나씩 올려가며 어느 번호가 존재하는지 훑을 수 있다
 * (handleDeleteProfile 과 같은 판단).
 *
 * 이미 그 사람이 "나" 인 경우도 200 이다. 결과 상태가 같으니 되돌릴 것이 없고,
 * 부르는 쪽(셀렉터)은 응답을 보지 않는다.
 */
export async function handleSetPrimary(
  id: string,
  d: SetPrimaryDeps,
): Promise<SetPrimaryResult> {
  if (d.userId === null) return { status: 401, body: { error: "로그인이 필요합니다" } };
  // URL 문자열을 그대로 ::bigint 로 캐스팅하면 DB 에러 → 500 이다.
  const param = parseProfileParam({ profile: id });
  if (param.kind !== "id") return { status: 400, body: { error: "요청을 확인해 주세요" } };

  if (!(await d.setPrimary(d.userId, param.id))) {
    return { status: 404, body: { error: "프로필을 찾을 수 없습니다" } };
  }
  return { status: 200, body: { primary: true } };
}
