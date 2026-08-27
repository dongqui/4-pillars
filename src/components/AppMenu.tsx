"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

interface Props {
  /** 로그인하지 않았으면 null — 익명 캐릭터만 보고 있는 상태다 */
  displayName: string | null;
}

/**
 * 헤더 오른쪽 오버플로 메뉴. 시안은 점 세 개만 있고 내용이 없어서,
 * 기존 랜딩 UserMenu 가 하던 일(계정·로그아웃)을 여기로 옮겼다.
 */
export function HomeMenu({ displayName }: Props) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center gap-[3px] rounded-[10px] border border-slate-200 bg-white hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-[3px] w-[3px] rounded-full bg-slate-500" />
        ))}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="계정 메뉴"
          className="absolute right-0 top-[calc(100%+8px)] w-[184px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-[0_12px_28px_-8px_rgba(15,23,42,.18)]"
        >
          {displayName === null ? (
            <>
              <p className="px-4 pb-1.5 pt-1 text-[12.5px] text-slate-400 [text-wrap:pretty]">
                로그인하면 캐릭터와 리포트가 계정에 저장돼요.
              </p>
              <Link
                href="/login"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-left text-sm font-semibold text-accent hover:bg-slate-50"
              >
                로그인
              </Link>
            </>
          ) : (
            <>
              <p className="truncate px-4 pb-1.5 pt-1 text-[12.5px] text-slate-400">
                {displayName}님
              </p>
              {/* 로그아웃은 POST 전용 라우트라 링크가 아니라 폼이어야 한다. */}
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  role="menuitem"
                  className="block w-full cursor-pointer px-4 py-2.5 text-left text-sm font-medium text-slate-500 hover:bg-slate-50"
                >
                  로그아웃
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
