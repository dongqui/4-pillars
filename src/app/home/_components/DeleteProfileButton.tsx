"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Props {
  /** 저장된 프로필만 지울 수 있다 — 드래프트는 이 버튼을 받지 않는다 */
  profileId: string;
  name: string;
}

const OVERLAY = "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-5";
const CARD = "w-full max-w-[360px] rounded-[18px] bg-white p-6 text-center shadow-xl";
const TITLE = "text-[17px] font-bold tracking-[-0.02em] text-slate-900 [text-wrap:balance]";
const NOTE = "mt-2.5 text-[13.5px] leading-[1.55] text-slate-500 [text-wrap:pretty]";
const ACTIONS = "mt-6 flex gap-2";
const CANCEL =
  "flex-1 cursor-pointer rounded-[12px] border border-slate-200 px-4 py-3 text-[14.5px] font-semibold text-slate-600 hover:bg-slate-50";
const CONFIRM =
  "flex-1 cursor-pointer rounded-[12px] bg-red-600 px-4 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400";

/** 휴지통. 글자를 넣기엔 셀렉터 행이 좁아서(모바일) 그림 하나로 세운다 */
function TrashGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-[17px] w-[17px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    >
      <path d="M2.5 4h11M6.2 4V2.6h3.6V4M4 4l.6 9.1h6.8L12 4" />
      <path d="M6.6 6.6v4M9.4 6.6v4" />
    </svg>
  );
}

/**
 * 보고 있는 프로필을 지우는 길. 홈에만 둔다 — 프로필을 고르는 곳과 지우는 곳이
 * 갈리면 "무엇을 지우는지" 를 화면이 설명하지 못한다.
 *
 * 확인을 한 번 받는다. window.confirm 이 아니라 다이얼로그인 이유: 이 삭제는
 * 이용권을 써서 연 전체 리포트와 궁합 결과까지 함께 가져가는데, 그 사실을 브라우저
 * 기본 대화상자의 한 줄에 담을 수 없다.
 */
export function DeleteProfileButton({ profileId, name }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      // 지우는 중에는 닫지 않는다 — 요청은 이미 떠났고, 닫아 봤자 결과만 못 본다.
      if (e.key !== "Escape" || pending) return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, pending]);

  // 확인 버튼이 아니라 컨테이너로 포커스를 보낸다 — 버튼에 걸면 다이얼로그가 뜨자마자
  // 도착한 Enter 가 질문을 읽기도 전에 삭제를 확정한다(SaveCounterpartModal 과 같은 판단).
  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

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
      // pending 을 풀지 않는다 — 새로고침이 끝나 이 컴포넌트가 사라질 때까지
      // 버튼은 잠겨 있어야 두 번째 DELETE 가 나가지 않는다.
      setOpen(false);
      router.refresh();
    } catch {
      setPending(false);
      setError("연결이 끊겼어요. 다시 시도해 주세요.");
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${name} 프로필 삭제`}
        // 삭제가 확정된 뒤에도 pending 은 풀리지 않는다(아래 remove 참고). 그 사이
        // 이 버튼이 살아 있으면 취소도 Escape 도 막힌 다이얼로그를 다시 열 수 있다.
        disabled={pending}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="flex h-[52px] w-[46px] flex-none cursor-pointer items-center justify-center rounded-[14px] border border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:text-slate-200 disabled:hover:border-slate-200 disabled:hover:bg-white"
      >
        <TrashGlyph />
      </button>

      {open && (
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
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className={CANCEL}
              >
                취소
              </button>
              <button type="button" onClick={remove} disabled={pending} className={CONFIRM}>
                {pending ? "지우는 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
