"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * v2 리포트가 failed 로 끝났을 때. v1 의 FlowError 와 달리 재시도 버튼이 있다 —
 * v2 는 pending revision 이 실패해도 flow 행 자체는 살아 있어 같은 URL 에서
 * POST /api/flows/[id]/revisions 로 다시 시도할 수 있다(§task-13).
 *
 * 이미 사용한 이용권은 다시 차감되지 않는다는 문구를 붙인다 — spendTicket 의
 * entitlements_unique 가 재차감을 막는다는 사실을 사용자 언어로 옮긴 것이다.
 */
export function FlowErrorV2({ flowId }: { flowId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/flows/${flowId}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      if (res.status === 409) {
        setMessage("이미 완성된 리포트가 있어요");
        router.refresh();
        return;
      }
      setMessage("잠시 후 다시 시도해 주세요.");
    } catch {
      setMessage("잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-[clamp(80px,20vw,160px)] text-center"
    >
      <div className="text-[22px] font-bold tracking-tight">운세를 완성하지 못했어요</div>
      <p className="mt-3 max-w-[380px] text-[15px] leading-[1.6] text-slate-500">
        다시 시도해 주세요. 이미 사용한 이용권은 다시 차감되지 않아요.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void retry()}
        className="mt-7 rounded-xl bg-accent px-5 py-[11px] text-[14.5px] font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-60"
      >
        {busy ? "다시 시도하는 중…" : "다시 시도"}
      </button>
      {message && <p className="mt-3 text-[13px] text-slate-400">{message}</p>}
    </div>
  );
}
