"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

/**
 * 지도 위의 헤더바. 지도를 만지면 사라지고 빈 곳을 탭하면 돌아온다.
 *
 * 판(시트·목록·추가 폼)이 열려 있는 동안은 hidden 을 무시하고 항상 보인다.
 * 그 위에서 나가는 길이 사라지면 사용자가 갇힌다.
 *
 * 숨겨진 상태에서도 위쪽 4px 손잡이를 남긴다 — 숨겨졌다는 사실 자체를 모르면
 * 되돌릴 방법도 알 수 없다.
 */
export function MapHeader({
  hidden,
  onReveal,
  isOwner,
  shareId,
  loggedIn,
}: {
  hidden: boolean;
  onReveal: () => void;
  isOwner: boolean;
  shareId: string;
  loggedIn: boolean;
}) {
  const [toast, setToast] = useState<string | null>(null);

  async function share() {
    const url = `${window.location.origin}/map/${shareId}`;
    // OS 공유 시트가 있으면 그쪽이 낫다 — 사용자가 이미 아는 UI 다.
    if (navigator.share) {
      try {
        await navigator.share({ title: "관계 지도", url });
        return;
      } catch {
        // 사용자가 취소한 경우도 여기로 온다. 복사로 물러선다.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast("링크를 복사했어요");
      setTimeout(() => setToast(null), 1800);
    } catch {
      setToast("링크를 복사하지 못했어요");
      setTimeout(() => setToast(null), 1800);
    }
  }

  return (
    <>
      {/* 손잡이. 헤더가 숨어 있을 때만 눌린다. */}
      {hidden && (
        <button
          type="button"
          aria-label="헤더 보이기"
          onClick={onReveal}
          className="fixed inset-x-0 top-0 z-30 h-1 bg-white/15"
        />
      )}

      <header
        className={`fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-slate-900/80 backdrop-blur-[14px] transition-transform duration-[180ms] motion-reduce:transition-none ${
          hidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <div className="flex h-14 items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)]">
          <Link href={loggedIn ? "/home" : "/"} className="shrink-0">
            <BrandLogo size="xs" />
          </Link>

          {isOwner && (
            <button
              type="button"
              onClick={share}
              className="rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-slate-100 hover:bg-white/20"
            >
              공유하기
            </button>
          )}
        </div>
      </header>

      {toast && (
        <p
          role="status"
          className="fixed left-1/2 top-[72px] z-40 -translate-x-1/2 rounded-full bg-slate-800/95 px-4 py-2 text-[13px] text-slate-100"
        >
          {toast}
        </p>
      )}
    </>
  );
}
