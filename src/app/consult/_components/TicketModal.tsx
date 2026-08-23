"use client";

import { useEffect } from "react";
import Link from "next/link";
import { DEFAULT_TURN_LIMIT } from "@/lib/consultations/budget";

interface Props {
  balance: number;
  onClose: () => void;
}

/**
 * 이용권이 없을 때 상담을 시작하려 하면 뜨는 안내(시안 "이용권 모달").
 *
 * 시안 문구는 "한 번 열면 자유롭게 대화할 수 있어요" 였는데 그대로 쓰지 않았다 —
 * 상담 한 건은 {@link DEFAULT_TURN_LIMIT} 턴까지고, 사기 전에 읽는 문구가 실제
 * 조건과 다르면 그건 시안이 아니라 오해다. 숫자도 상수에서 읽어 예산이 바뀌면
 * 문구가 같이 따라간다.
 */
export function TicketModal({ balance, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 p-6 backdrop-blur-[3px]"
    >
      <div className="w-full max-w-[352px] rounded-[22px] bg-white px-[26px] pb-[22px] pt-[30px] shadow-[0_24px_60px_-12px_rgba(15,23,42,0.3)]">
        <div className="mb-[18px] flex h-11 w-11 items-center justify-center rounded-[14px] bg-accent-50 text-[16px] font-extrabold tracking-[-0.03em] text-accent">
          1
        </div>
        <h2 id="ticket-modal-title" className="mb-2 text-[19px] font-bold tracking-[-0.03em]">
          이용권이 필요해요
        </h2>
        <p className="mb-5 text-[14.5px] leading-[1.6] text-slate-500 [text-wrap:pretty]">
          상담 1건을 시작하려면 이용권 1장이 필요합니다. 한 번 열면 그 상담에서{" "}
          {DEFAULT_TURN_LIMIT}번까지 이야기할 수 있어요.
        </p>
        <div className="mb-5 flex items-center justify-between rounded-[13px] border border-slate-100 bg-slate-50 px-[15px] py-[13px]">
          <span className="text-[13.5px] text-slate-500">보유 이용권</span>
          <span className="text-[14.5px] font-bold tabular-nums text-slate-900">{balance}장</span>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href="/checkout?next=/consult"
            className="flex h-[50px] items-center justify-center rounded-[14px] bg-accent text-[15.5px] font-bold tracking-[-0.02em] text-white hover:bg-accent-700"
          >
            이용권 구매하기
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="h-[46px] rounded-[14px] text-[14.5px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            다음에 할게요
          </button>
        </div>
      </div>
    </div>
  );
}
