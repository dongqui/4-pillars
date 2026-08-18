"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

export type UnlockStatus = "idle" | "pending";

/**
 * 이용권으로 전체 리포트를 연다.
 *
 * 성공 뒤 router.refresh() 를 부르는 이유: 유료 섹션 생성은 서버 컴포넌트가 한다.
 * 여기서 화면 상태만 바꾸면 잠금만 풀리고 내용이 비어 있다.
 *
 * ⚠️ refresh 직후가 이 앱에서 가장 느린 순간이다 — 유료 12섹션 첫 생성이 통째로
 * 그 요청에 걸린다(report/page.tsx 의 maxDuration 주석 참조). 화면은 그동안
 * pending 을 유지해 사용자가 버튼을 다시 누르지 않게 한다. 다시 눌러도 권한
 * UNIQUE 가 이중 차감을 막지만, 응답을 두 번 기다리게 할 이유는 없다.
 */
export function useUnlock(profileId: string | undefined) {
  const router = useRouter();
  const [status, setStatus] = useState<UnlockStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const unlock = useCallback(async () => {
    if (!profileId) return;
    setStatus("pending");
    setError(null);
    try {
      const res = await fetch("/api/tickets/spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature: "full_report", subjectKey: profileId }),
      });

      // 402 는 잔액 부족이다. 충전하고 돌아올 자리를 넘긴다.
      if (res.status === 402) {
        router.push(
          `/checkout?next=${encodeURIComponent(`/report?profile=${profileId}`)}`,
        );
        return;
      }
      // 401 은 렌더 이후 세션이 끊긴 경우다(만료·다른 탭 로그아웃). 그대로 두면
      // "리포트를 열지 못했습니다"로만 뜨고 사용자는 왜인지 알 방법이 없다 —
      // 402 와 같은 모양으로 돌아올 자리를 실어 로그인으로 보낸다.
      if (res.status === 401) {
        router.push(
          `/login?next=${encodeURIComponent(`/report?profile=${profileId}`)}`,
        );
        return;
      }
      if (!res.ok) throw new Error("리포트를 열지 못했습니다");

      // 200 은 spent 와 already 둘 다다. 화면이 할 일은 같다 — 다시 그린다.
      router.refresh();
      // pending 을 풀지 않는다: refresh 가 끝나면 이 컴포넌트 자체가 사라진다.
    } catch (e) {
      setError(e instanceof Error ? e.message : "리포트를 열지 못했습니다");
      setStatus("idle");
    }
  }, [profileId, router]);

  return { unlock, status, error };
}
