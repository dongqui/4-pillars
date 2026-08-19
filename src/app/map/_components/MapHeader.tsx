"use client";

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
 *
 * 토스트는 더 이상 여기가 갖고 있지 않다. 삭제 실패도 같은 자리에 떠야 하는데
 * 그것을 아는 곳은 MapShell 이라, 두 벌을 만들지 않고 MapShell 로 올렸다.
 */
export function MapHeader({
  hidden,
  onReveal,
  isOwner,
  shareId,
  loggedIn,
  onToast,
}: {
  hidden: boolean;
  onReveal: () => void;
  isOwner: boolean;
  shareId: string;
  loggedIn: boolean;
  onToast: (message: string) => void;
}) {
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
      onToast("링크를 복사했어요");
    } catch {
      onToast("링크를 복사하지 못했어요");
    }
  }

  return (
    <>
      {/*
        손잡이. 헤더가 숨어 있을 때만 눌린다. top-0 이 아니라 노치 아래로
        내린다 — 상태 바/노치 영역은 탭이 닿지 않는 기기가 많아, top-0 에
        두면 노치가 있는 폰에서 손잡이 자체가 눌리지 않는 사각이 생긴다.
      */}
      {hidden && (
        <button
          type="button"
          aria-label="헤더 보이기"
          onClick={onReveal}
          className="fixed inset-x-0 top-[env(safe-area-inset-top)] z-30 h-1 bg-white/15"
        />
      )}

      <header
        // 세이프 에어리어 인셋은 헤더 높이(h-14, 56px) 를 늘리는 오프셋으로
        // 얹는다 — 안쪽 padding 으로 넣으면 노치 기기(세이프 인셋 44~59px)에서
        // 내부 flex 행이 h-14 박스보다 커져 블러 배경 밖, 캔버스 위로
        // 삐져나온다. 이 라우트의 기준 기기(375×812)로는 이 코드만으로
        // 실기기 확인을 못 했다 — 노치 폰을 가진 사람이 검증해 주면 좋겠다.
        className={`fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-slate-900/80 pt-[env(safe-area-inset-top)] backdrop-blur-[14px] transition-transform duration-[180ms] motion-reduce:transition-none ${
          hidden ? "-translate-y-full" : "translate-y-0"
        }`}
        // 자리는 옮겨졌을 뿐 여전히 tab 으로 포커스가 간다 — inert 없이는
        // 숨은 헤더의 로고 링크·공유 버튼이 화면 밖에서 여전히 포커스를 받아
        // 키보드/스위치 사용자가 보이지 않는 곳으로 튄다. PersonSheet·
        // AddPersonSheet 와 같은 패턴이다.
        inert={hidden}
      >
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link href={loggedIn ? "/home" : "/"} className="shrink-0 text-slate-100">
            <BrandLogo size="xs" tone="light" />
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
    </>
  );
}
