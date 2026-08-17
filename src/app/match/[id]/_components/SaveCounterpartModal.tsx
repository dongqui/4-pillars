"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  counterpartId: string;
  counterpartName: string;
}

const OVERLAY = "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-5";
const CARD = "w-full max-w-[360px] rounded-[18px] bg-white p-6 text-center shadow-xl";
const TITLE = "text-[17px] font-bold tracking-[-0.02em] text-slate-900 [text-wrap:balance]";
const ACTIONS = "mt-6 flex gap-2";
const SECONDARY =
  "flex-1 rounded-[12px] border border-slate-200 px-4 py-3 text-[14.5px] font-semibold text-slate-600 hover:bg-slate-50";
const PRIMARY =
  "flex-1 rounded-[12px] bg-accent px-4 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400";

/**
 * 결과 화면이 렌더 여부(?new=1 && counterpart.kind==='other')를 결정하고,
 * 이 컴포넌트는 뜬 뒤의 상호작용만 다룬다.
 *
 * 승격 API 는 이미 'self' 여도 200 을 준다 — 그 응답도 여기서는 그냥 닫는 것으로
 * 처리한다. "실패"가 아니라 "할 일 없음"이라 별도 에러 문구가 필요 없다.
 */
export function SaveCounterpartModal({ counterpartId, counterpartName }: Props) {
  const [open, setOpen] = useState(true);
  const [pending, setPending] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape 로 닫을 수 있어야 한다 — 포커스가 어디 있든(자동 포커스를 걸지 않았으므로)
  // 건너뛰고 싶은 사용자를 붙잡지 않는다.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // 열릴 때 포커스를 다이얼로그 컨테이너로 옮긴다 — open 을 의존성에 둬서, 이
  // 컴포넌트는 지금 구조상 마운트 시 open=true 로 시작해 다시 true 로 돌아오는
  // 경로가 없지만(페이지가 offerSave 로 렌더 여부를 이미 정해 넘기고, 닫히면
  // return null 로 숨을 뿐 리마운트되지 않는다), 나중에 재오픈 경로가 생겨도
  // 같은 코드가 맞게 동작하도록 "보이게 되는 시점"에 직접 건다.
  //
  // 확인 버튼이 아니라 컨테이너에 건다: 이 저장은 남의 생년월일을 내 목록에
  // 얹는 동작이라, 포커스가 확인 버튼에 있으면 모달이 뜨자마자 도착한 Enter가
  // 질문을 읽기도 전에 저장을 확정시켜 버릴 수 있다. 컨테이너로 보내면
  // 스크린리더가 다이얼로그의 등장과 내용을 읽어주면서도 선택은 사용자 몫으로
  // 남는다.
  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  if (!open) return null;

  async function save() {
    setPending(true);
    try {
      await fetch(`/api/profiles/${counterpartId}/promote`, { method: "POST" });
    } finally {
      // 네트워크 실패라도 닫는다 — 재시도 동선이 없고, 다시 방문하면 kind 가 여전히
      // 'other' 이니 모달이 또 뜬다.
      setOpen(false);
    }
  }

  return (
    <div className={OVERLAY} role="dialog" aria-modal="true" aria-labelledby="save-counterpart-title">
      <div ref={dialogRef} tabIndex={-1} className={CARD}>
        <p id="save-counterpart-title" className={TITLE}>
          {counterpartName}님을 내 사주 목록에도 저장할까요?
        </p>
        <div className={ACTIONS}>
          <button type="button" onClick={() => setOpen(false)} className={SECONDARY}>
            아니요
          </button>
          <button type="button" onClick={save} disabled={pending} className={PRIMARY}>
            {pending ? "저장하는 중..." : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
