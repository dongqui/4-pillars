import { safeNextPath } from "@/lib/nav/next-param";

/**
 * POST /api/flows 응답 상태 → 확인 화면(state.kind==="new")이 CTA 아래에 보여줄 문구.
 *
 * 이 화면은 결제가 걸린 버튼 하나가 전부다. 실패를 조용히 삼키면(버튼만 다시
 * 눌리게 두면) 이용권이 0장인 사용자는 "이용권 1장을 사용합니다" 를 보고 눌렀는데
 * 아무 일도 안 일어난 것처럼 보인다 — 구매를 확인하는 화면에서 가장 나쁜 결과다.
 *
 * 상태 코드만으로 문구를 정한다: flows API 는 본문에 사람이 읽을 문장을 담지
 * 않고 reason 문자열만 준다 (src/app/api/flows/_lib/handler.ts 의 STATUS 매핑 —
 * unauthenticated→401, rate_limited→429, insufficient_tickets→402).
 *
 * 성공(2xx)이면 null 이다. 컴포넌트는 그 경우 이 함수를 부르지 않지만(성공은
 * router.push 로 곧장 이어진다), 이 함수의 도메인을 성공까지 포함해 두면
 * 테스트가 "실패만 다루는 함수" 라는 암묵의 경계 없이 전체를 검증할 수 있다.
 */
export interface StartFailure {
  text: string;
  action?: { label: string; href: string };
}

export function toStartOutcome(status: number): StartFailure | null {
  if (status >= 200 && status < 300) return null;

  switch (status) {
    case 402:
      // "이용권이 부족해요" 는 src/lib/flows/tickets.ts 의 FlowTicketsError, 그리고
      // 궁합 쪽 402 응답 문구(src/app/api/matches/_lib/handler.ts 의 ACCESS_MESSAGE)
      // 가 같이 쓰는 말이다. 이어지는 문장과 CTA 라벨은
      // src/app/match/[id]/_components/MatchOutOfTickets.tsx 의 문구를 그대로 따른다
      // — 충전 경로도 그쪽과 같은 /checkout?next=... 다, 새로 지어내지 않는다.
      return {
        text: "이용권이 부족해요. 충전하면 이 화면으로 돌아와 바로 이어서 볼 수 있어요.",
        action: {
          label: "충전하고 이어서 보기",
          href: `/checkout?next=${encodeURIComponent(safeNextPath("/flow"))}`,
        },
      };
    case 429:
      // FLOW_HOURLY_LIMIT 은 고정 윈도(incr + expire NX, src/lib/flows/rate-limit.ts)라
      // 다음 초기화까지 남은 시간을 이 자리에서 알 수 없다 — 첫 요청이 창을 연
      // 시점에 따라 몇 초 뒤일 수도, 한 시간 가까이 뒤일 수도 있다. 그래서
      // "한 시간 뒤" 처럼 코드가 보장하지 않는 구체적인 시간을 약속하지 않는다.
      return {
        text: "지금의 흐름 생성 시간당 한도에 도달했어요. 잠시 후 다시 시도해 주세요.",
      };
    case 401:
      // "세션이 끊긴 경우" — src/app/report/_hooks/use-unlock.ts 의 401 분기와
      // 같은 상황이다. 그쪽은 곧장 router.push 하지만, 이 화면은 실패를 조용히
      // 삼키지 않고 CTA 아래에 안내와 링크를 남기기로 했다(사람 판단).
      return {
        text: "로그인이 끊겼어요. 다시 로그인해 주세요.",
        action: {
          label: "다시 로그인하기",
          href: `/login?next=${encodeURIComponent(safeNextPath("/flow"))}`,
        },
      };
    default:
      // 매치 쪽 rate_limited 응답 본문과 이 레포 여러 곳(DeleteProfileDialog,
      // AddPersonSheet 등)이 쓰는 중립 문구와 같은 말이다.
      return { text: "잠시 후 다시 시도해 주세요." };
  }
}
