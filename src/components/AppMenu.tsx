"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { loginHref } from "@/lib/nav/next-param";

interface Props {
  /** 로그인하지 않았으면 null — 익명 캐릭터만 보고 있는 상태다 */
  displayName: string | null;
}

/**
 * 헤더 오른쪽 오버플로 메뉴. 시안은 점 세 개만 있고 내용이 없어서,
 * 기존 랜딩 UserMenu 가 하던 일(계정·로그아웃)을 여기로 옮겼다.
 *
 * 홈 전용이 아니다 — 상담·궁합도 같은 헤더를 쓰므로 라우트 폴더가 아니라
 * 공용 컴포넌트에 산다(AppHeader 가 유일한 호출자다).
 */
export function AppMenu({ displayName }: Props) {
  const [open, setOpen] = useState(false);
  // 로그인하고 나면 보던 화면으로 되돌아와야 한다 — 이 메뉴는 화면 위에 얹혀 있어서
  // 자기가 어디인지 런타임에 읽는 수밖에 없다(로그인을 요구하는 화면들은 서버에서
  // 손으로 ?next 를 붙인다).
  //
  // 쿼리는 싣지 않는다. useSearchParams 를 쓰면 이 헤더를 공유하는 화면이 프리렌더될 때
  // 가장 가까운 Suspense 경계까지 클라이언트 렌더로 내려간다. 그걸 감수할 값이 아니다 —
  // 이 갈래(비로그인)가 실제로 보이는 화면은 드래프트 리포트뿐이고, 거기엔 ?profile 이
  // 없다(id 가 붙은 리포트는 비로그인이면 report/page.tsx 가 먼저 로그인으로 보낸다).
  const pathname = usePathname();
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
                href={loginHref(pathname)}
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
