"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Props {
  /** 저장된 프로필만 지울 수 있다 — 드래프트는 이 다이얼로그를 받지 않는다 */
  profileId: string;
  name: string;
  /** 지우지 않고 닫았을 때 */
  onClose: () => void;
  /** 삭제가 끝났을 때. 셀렉터가 고른 줄을 다시 맞춘다 */
  onDeleted: () => void;
}

const OVERLAY = "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-5";
const CARD = "w-full max-w-[360px] rounded-[18px] bg-white p-6 text-center shadow-xl";
const TITLE = "text-[17px] font-bold tracking-[-0.02em] text-slate-900 [text-wrap:balance]";
const NOTE = "mt-2.5 text-[13.5px] leading-[1.55] text-slate-500 [text-wrap:pretty]";
const ACTIONS = "mt-6 flex gap-2";
const CANCEL =
  "flex-1 cursor-pointer rounded-[12px] border border-slate-200 px-4 py-3 text-[14.5px] font-semibold text-slate-600 hover:bg-slate-50";
const CONFIRM =
  "flex-1 cursor-pointer rounded-[12px] bg-red-600 px-4 py-3 text-[14.5px] font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400";

/**
 * 보고 있는 프로필을 지우는 길. 셀렉터 안에서만 연다 — 프로필을 고르는 곳과 지우는 곳이
 * 갈리면 "무엇을 지우는지" 를 화면이 설명하지 못한다.
 *
 * 확인을 한 번 받는다. window.confirm 이 아니라 다이얼로그인 이유: 이 삭제는
 * 이용권을 써서 연 전체 리포트와 궁합 결과까지 함께 가져가는데, 그 사실을 브라우저
 * 기본 대화상자의 한 줄에 담을 수 없다.
 */
export function DeleteProfileDialog({ profileId, name, onClose, onDeleted }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // 지우는 중에는 닫지 않는다 — 요청은 이미 떠났고, 닫아 봤자 결과만 못 본다.
      if (e.key !== "Escape" || pending) return;
      onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pending, onClose]);

  // 확인 버튼이 아니라 컨테이너로 포커스를 보낸다 — 버튼에 걸면 다이얼로그가 뜨자마자
  // 도착한 Enter 가 질문을 읽기도 전에 삭제를 확정한다(SaveCounterpartModal 과 같은 판단).
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  async function remove() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/profiles/${profileId}`, { method: "DELETE" });
      if (!res.ok) {
        setPending(false);
        // 404 는 다른 탭에서 이미 지운 경우가 대부분이다 — 새로고침이 답이라고 말해준다.
        setError(
          res.status === 404
            ? "이미 지워진 프로필이에요. 새로고침해 주세요."
            : "프로필을 지우지 못했어요. 잠시 후 다시 시도해 주세요.",
        );
        return;
      }
      router.refresh();
      onDeleted();
    } catch {
      setPending(false);
      setError("연결이 끊겼어요. 다시 시도해 주세요.");
    }
  }

  return (
    <div className={OVERLAY} role="dialog" aria-modal="true" aria-labelledby="delete-profile-title">
      <div ref={dialogRef} tabIndex={-1} className={CARD}>
        <p id="delete-profile-title" className={TITLE}>
          {name} 프로필을 지울까요?
        </p>
        <p className={NOTE}>
          이 사주로 본 리포트와 궁합 결과가 함께 사라져요. 이용권을 써서 연 전체
          리포트도 다시 열어야 해요. 되돌릴 수 없어요.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-[13px] font-semibold text-red-600">
            {error}
          </p>
        )}
        <div className={ACTIONS}>
          <button type="button" disabled={pending} onClick={onClose} className={CANCEL}>
            취소
          </button>
          <button type="button" onClick={remove} disabled={pending} className={CONFIRM}>
            {pending ? "지우는 중..." : "삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}
