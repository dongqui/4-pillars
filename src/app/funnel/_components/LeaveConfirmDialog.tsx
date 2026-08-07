"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/Button";

interface LeaveConfirmDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 퍼널을 벗어나려 할 때 묻는 확인 창. 열려 있는 동안만 마운트한다.
 *
 * 직접 만든 오버레이 대신 <dialog>.showModal() 을 쓰는 이유 — top layer, 포커스 트랩,
 * 바깥 요소 inert, Esc 를 브라우저가 다 해준다. (window.confirm 이 아니므로 JS 를
 * 멈추지 않는다.)
 */
export function LeaveConfirmDialog({ onConfirm, onCancel }: LeaveConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  // 마크업으로는 모달로 열 수 없다 — 마운트 직후 한 번 호출한다.
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(e) => {
        // Esc. 브라우저 기본 동작에 맡기면 DOM 만 닫히고 React 상태는 열린 채로 남아
        // 다음 클릭에 다시 열리지 않는다 — 닫는 일은 부모에게 넘긴다.
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        // 백드롭 클릭은 dialog 자신이 받는다(안쪽 내용은 target 이 다르다).
        if (e.target === ref.current) onCancel();
      }}
      // Tailwind preflight 가 dialog 의 margin:auto 를 지워서 가운데 정렬을 되돌린다.
      className="m-auto w-[calc(100%-2.5rem)] max-w-[360px] rounded-2xl bg-white p-6 text-slate-900 shadow-[0_24px_48px_-12px_rgba(15,23,42,.35)] backdrop:bg-slate-900/40"
    >
      <h2 id={titleId} className="text-[17px] font-bold tracking-tight">
        입력을 그만두시겠어요?
      </h2>
      <p id={descId} className="mt-2 text-sm leading-relaxed text-slate-500">
        지금 나가면 입력한 사주 정보가 사라져요. 다시 오시면 처음부터 입력해야 해요.
      </p>
      <div className="mt-5 flex gap-2.5">
        {/* showModal 은 첫 포커스 가능 요소에 포커스를 준다 — 안전한 쪽을 앞에 둔다. */}
        <Button variant="secondary" fullWidth onClick={onCancel}>
          계속 입력
        </Button>
        <Button variant="danger" fullWidth onClick={onConfirm}>
          나가기
        </Button>
      </div>
    </dialog>
  );
}
