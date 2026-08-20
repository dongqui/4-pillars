"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

/**
 * 지도 위의 헤더바. 언제나 보인다.
 *
 * 한동안은 지도를 만지면 위로 숨고 빈 곳을 탭하면 돌아왔다. 화면을 넓게 쓰려던
 * 것인데, 숨었다는 사실 자체를 모르면 되돌릴 방법도 모른다는 문제가 있어
 * 4px 손잡이를 남겨야 했고 판이 열릴 때는 예외로 다시 띄워야 했다 — 규칙이
 * 셋이었다. 상시 표시로 바꾸면서 그 셋이 전부 사라졌다. 56px 을 돌려받는
 * 대신 나가는 길이 언제나 같은 자리에 있다.
 *
 * 토스트는 여기가 갖고 있지 않다. 삭제 실패도 같은 자리에 떠야 하는데 그것을
 * 아는 곳은 MapShell 이라, 두 벌을 만들지 않고 MapShell 로 올렸다.
 */
export function MapHeader({
  isOwner,
  shareId,
  loggedIn,
  onToast,
}: {
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
    <header
        // 세이프 에어리어 인셋은 헤더 높이(h-14, 56px) 를 늘리는 오프셋으로
        // 얹는다 — 안쪽 padding 으로 넣으면 노치 기기(세이프 인셋 44~59px)에서
        // 내부 flex 행이 h-14 박스보다 커져 블러 배경 밖, 캔버스 위로
        // 삐져나온다. 이 라우트의 기준 기기(375×812)로는 이 코드만으로
        // 실기기 확인을 못 했다 — 노치 폰을 가진 사람이 검증해 주면 좋겠다.
      className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-slate-900/80 pt-[env(safe-area-inset-top)] backdrop-blur-[14px]"
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
  );
}
