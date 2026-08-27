import type { ReactNode } from "react";
import { AppBrand } from "./AppBrand";
import { AppMenu } from "./AppMenu";

interface Props {
  /** 로그인하지 않았으면 null — 메뉴가 로그아웃 대신 로그인을 내민다. */
  displayName: string | null;
  /**
   * 안쪽 줄의 가로폭과 좌우 여백. 본문 컨테이너와 **같은 값**을 넘긴다 —
   * 헤더가 본문보다 넓거나 좁으면 로고와 본문 왼쪽 끝이 어긋나 두 컨테이너가
   * 서로 다른 화면처럼 보인다. 기본값은 시안의 720px 폭이다.
   */
  inner?: string;
  /** 메뉴 왼쪽에 붙는 것 — 예: 홈의 이용권 알약. */
  children?: ReactNode;
}

/**
 * 서비스 화면(홈 · 리포트 · 상담 · 궁합 · 흐름)이 같이 쓰는 머리글: 로고 한 번, 메뉴 한 번.
 *
 * 화면마다 헤더를 따로 그리던 자리다. 리포트·궁합 결과·흐름이 같은 마크업을 세 벌
 * 갖고 있었고 상담·궁합 입력에는 아예 없어서, 나가는 길이 화면마다 다른 모양이었다.
 *
 * 나가는 길은 로고다. 로고가 /home 으로 가므로 옆에 "← 홈"(옛 HomeLink)을 따로 두지
 * 않는다 — 같은 곳으로 가는 버튼 두 개는 어느 쪽이 무엇인지 묻게 만든다.
 */
export function AppHeader({
  displayName,
  inner = "max-w-[720px] px-[clamp(20px,5vw,24px)]",
  children,
}: Props) {
  return (
    <header className="sticky top-0 z-50 flex-none border-b border-slate-100 bg-white/[0.92] backdrop-blur-[10px]">
      <div className={`mx-auto flex items-center justify-between gap-3 py-3.5 ${inner}`}>
        <AppBrand href="/home" size="xs" />
        <div className="flex items-center gap-2.5">
          {children}
          <AppMenu displayName={displayName} />
        </div>
      </div>
    </header>
  );
}
