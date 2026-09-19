import { createHash, timingSafeEqual } from "node:crypto";
// 타입만 가져온다 — login/page.tsx 가 이 파일을 import 하므로 DB 클라이언트를 끌어오면 안 된다.
import type { CreateProfileInput, ProfileKind } from "@/lib/profiles/store";

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

/**
 * `identifier` 는 아이디여도 이메일이어도 된다 — 카드사에는 이메일을 계정으로 알려 준다.
 * 어느 쪽으로 들어와도 같은 계정이다(users 행은 config.id 로 묶인다).
 * 이메일만 대소문자를 가리지 않는다: 모바일 키보드가 첫 글자를 올린다.
 */
export function verifyReviewLogin(
  config: ReviewLoginConfig,
  identifier: string,
  password: string,
): boolean {
  // 셋 다 계산한 뒤 합친다 — 바로 이으면 어느 것이 틀렸는지가 걸린 시간으로 샌다.
  const entered = identifier.trim();
  const idOk = sameString(entered, config.id);
  const emailOk = sameString(entered.toLowerCase(), config.email.toLowerCase());
  const passwordOk = sameString(password, config.password);
  return (idOk || emailOk) && passwordOk;
}

/**
 * 첫 로그인에 넣어 두는 샘플 프로필. 담당자가 생년월일을 넣지 않아도 홈·리포트·결제까지
 * 바로 볼 수 있게 한다. 여느 저장 프로필과 똑같은 행이다 — 표시도, 특별 취급도 없다.
 */
export const REVIEW_SAMPLE_PROFILE: CreateProfileInput = {
  name: "홍길동",
  gender: "male",
  calendar: "solar",
  isLeapMonth: false,
  birth: { year: 1990, month: 5, day: 15 },
  timeKnown: true,
  time: { hour: 9, minute: 30 },
  birthPlace: null,
  trueSolar: true,
  kind: "saved",
};

export interface SeedSampleDeps {
  countProfiles: (userId: string, kind: ProfileKind) => Promise<number>;
  createProfile: (userId: string, input: CreateProfileInput) => Promise<{ id: string }>;
  /** "나" 가 아직 없으면 이 프로필로 정한다. 이미 있으면 아무 일도 하지 않는다. */
  setPrimaryIfUnset: (userId: string, profileId: string) => Promise<void>;
}

/**
 * 저장된 프로필이 하나도 없을 때만 샘플을 만든다 — 로그인할 때마다 쌓이지 않고,
 * 담당자가 지우면 다음 로그인에 다시 선다.
 *
 * 절대 throw 하지 않는다(promoteDraft 와 같은 계약) — 호출 시점에 세션 쿠키는 아직
 * 응답에 실리지 않았고, 여기서 새면 샘플 실패가 로그인 실패로 번진다.
 */
export async function seedSampleProfile(userId: string, deps: SeedSampleDeps): Promise<void> {
  try {
    if ((await deps.countProfiles(userId, "saved")) > 0) return;
    const { id } = await deps.createProfile(userId, REVIEW_SAMPLE_PROFILE);
    await deps.setPrimaryIfUnset(userId, id);
  } catch (e) {
    console.error("[review-login] sample profile", e instanceof Error ? e.message : e);
  }
}
