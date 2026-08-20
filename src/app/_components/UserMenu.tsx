"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { displayInitial } from "@/lib/auth/display-name";

interface UserMenuProps {
  displayName: string;
}

/**
 * 랜딩 내비의 프로필 칩 + 드롭다운. 랜딩에서 유일하게 클라이언트 JS 가 필요한 조각이라
 * 여기만 "use client" 로 떼어 놓는다 — LandingNav 자체는 서버 컴포넌트로 남는다.
 */
export function UserMenu({ displayName }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const chipRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    // Escape 는 포커스를 칩으로 되돌린다. 바깥 클릭은 이미 다른 곳을 가리키고 있으니 두지 않는다.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      chipRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative ml-1">
      <button
        ref={chipRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white py-[5px] pl-[5px] pr-[13px] text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-accent-soft text-[12.5px] font-bold text-accent">
          {displayInitial(displayName)}
        </span>
        {displayName}님
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="계정 메뉴"
          className="absolute right-0 top-[calc(100%+8px)] w-[168px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-[0_12px_28px_-8px_rgba(15,23,42,.18)]"
        >
          <Link
            href="/home"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-left text-[14px] font-medium text-slate-700 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
          >
            내 사주
          </Link>
          {/* 로그아웃은 POST 전용 라우트라 링크가 아니라 폼이어야 한다. */}
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              role="menuitem"
              className="block w-full cursor-pointer px-4 py-2.5 text-left text-[14px] font-medium text-slate-500 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
            >
              로그아웃
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
