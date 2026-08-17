import { cookies } from "next/headers";
import { DRAFT_COOKIE, getDraft, isValidDraftToken } from "./store";
import type { CreateProfileBody } from "@/lib/profiles/input";

/**
 * 이 브라우저가 들고 있는 익명 드래프트. 없거나 만료됐으면 null.
 *
 * 지금까지 드래프트를 읽는 곳은 OAuth 콜백(NextRequest 로 쿠키를 읽는다)뿐이었는데,
 * 리빌·홈이 서버 컴포넌트에서 같은 값을 봐야 해서 `cookies()` 판을 따로 둔다.
 */
export async function readCurrentDraft(): Promise<CreateProfileBody | null> {
  const token = (await cookies()).get(DRAFT_COOKIE)?.value;
  if (!token || !isValidDraftToken(token)) return null;
  try {
    return await getDraft(token);
  } catch (e) {
    // Redis 가 흔들려도 화면은 서야 한다 — 드래프트가 없는 것과 같이 취급한다.
    console.error("[drafts] getDraft", e instanceof Error ? e.message : e);
    return null;
  }
}
