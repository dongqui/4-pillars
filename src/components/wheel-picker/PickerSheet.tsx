"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/Button";

interface Props {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}

/**
 * 휠 피커를 담는 시트. 모바일은 아래에서 올라오는 바텀시트, 데스크톱은 가운데
 * 모달 — 같은 내용을 화면 폭에 맞춰 놓는 자리만 다르다. 열려 있는 동안만 마운트한다.
 *
 * 값은 부모가 초안으로 들고 있다가 "확인"에서만 확정한다 — 바깥 클릭·Esc 는
 * 취소라서, 처음 열었다 닫아도 빈 칸이 채워지지 않는다.
 *
 * <dialog>.showModal() 을 쓰는 이유는 LeaveConfirmDialog 와 같다 — top layer,
 * 포커스 트랩, 바깥 inert, Esc 를 브라우저가 해준다.
 */
export function PickerSheet({ title, onConfirm, onCancel, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
      // Tailwind preflight 가 dialog 의 margin:auto 를 지운다. 모바일은 margin-top:auto
      // 로 바닥에 붙이고, md 부터는 m-auto 로 가운데에 둔다.
      className="saju-sheet-up mx-0 mb-0 mt-auto w-full max-w-none rounded-t-[22px] bg-white px-5 pb-[max(26px,env(safe-area-inset-bottom))] pt-3 text-slate-900 shadow-[0_-18px_50px_-18px_rgba(15,23,42,.35)] backdrop:bg-slate-900/40 md:m-auto md:w-[400px] md:max-w-[calc(100%-2.5rem)] md:rounded-[22px] md:p-6 md:shadow-[0_24px_48px_-12px_rgba(15,23,42,.35)]"
    >
      {/* 모바일 손잡이 */}
      <div aria-hidden className="mx-auto mb-3.5 h-1 w-[38px] rounded-full bg-slate-200 md:hidden" />
      <h2 id={titleId} className="text-[17px] font-bold tracking-[-0.03em]">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
      <Button
        onClick={onConfirm}
        fullWidth
        className="mt-4 rounded-[14px] py-[15px] text-base shadow-none"
      >
        확인
      </Button>
    </dialog>
  );
}
