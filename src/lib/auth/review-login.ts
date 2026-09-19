import { createHash, timingSafeEqual } from "node:crypto";

/**
 * PG 카드사 심사용 임시 로그인.
 *
 * 우리는 간편 로그인만 있는데, 카드사 심사는 담당자가 들어올 수 있는 아이디·비밀번호를
 * 요구한다. 그 계정 하나를 위해 비밀번호 가입 체계를 들이지 않고, 자격을 환경변수에 둔다.
 * 셋 중 하나라도 비면 기능 전체가 꺼진다 — 심사가 끝나면 env 를 지우는 것으로 닫는다.
 *
 * ⚠️ 임시 코드다. 걷어낼 때: 이 파일 · review-login.test.ts · api/auth/review-login/ ·
 * login/page.tsx 의 심사용 블록 · .env.example 의 REVIEW_LOGIN_* 를 함께 지운다.
 * 0049 마이그레이션과 CHECK 의 'admin' 은 남긴다 — 되돌릴 이유가 없고, 이미 들어간 행이 걸린다.
 */

/**
 * users.provider 에 들어가는 값. 0049 가 CHECK 에 연 자리다 — 소셜 제공자를 거치지 않고
 * 아이디·비밀번호로 들어오는 운영 계정.
 *
 * ⚠️ "어떻게 로그인했나" 일 뿐 **권한이 아니다.** 이 값을 보고 관리자 기능을 열면 안 된다 —
 * 이 계정의 비밀번호는 카드사 담당자들에게 공유된다.
 */
export const REVIEW_PROVIDER = "admin";

export const REVIEW_DISPLAY_NAME = "심사용 계정";

export interface ReviewLoginConfig {
  id: string;
  password: string;
  /** 결제창에 구매자 이메일로 넘어간다. 로그인이 이메일을 요구하는 규칙(MissingEmailError)과 같은 이유. */
  email: string;
}

/** "켜짐/꺼짐" 의 유일한 출처. 페이지와 라우트가 같은 답을 보게 여기서만 env 를 읽는다. */
export function reviewLoginConfig(): ReviewLoginConfig | null {
  const id = process.env.REVIEW_LOGIN_ID?.trim();
  const password = process.env.REVIEW_LOGIN_PASSWORD;
  const email = process.env.REVIEW_LOGIN_EMAIL?.trim();
  if (!id || !password || !email) return null;
  return { id, password, email };
}

/** 해시한 뒤 비교한다 — timingSafeEqual 은 길이가 다르면 던지고, 길이 자체도 새면 안 된다. */
function sameString(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function verifyReviewLogin(config: ReviewLoginConfig, id: string, password: string): boolean {
  // 둘 다 계산한 뒤 합친다 — && 로 바로 이으면 아이디가 틀릴 때만 빨리 끝난다.
  const idOk = sameString(id.trim(), config.id);
  const passwordOk = sameString(password, config.password);
  return idOk && passwordOk;
}
