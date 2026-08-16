"use client";

import { useEffect, useState } from "react";

/**
 * 뷰포트 폭(px). 캐릭터 카드는 폭을 숫자로 받으므로(1080 캔버스를 zoom 으로 줄인다)
 * CSS 브레이크포인트로는 크기를 못 정한다 — 실제 값을 재서 넘겨야 한다.
 *
 * 서버에서는 잴 수 없어 모바일 폭으로 시작한다. 이 서비스의 첫 화면은 대부분
 * 휴대폰이라, 데스크톱에서 한 번 커지는 쪽이 모바일에서 잘려 보이는 쪽보다 낫다.
 */
const SSR_WIDTH = 390;

export function useViewportWidth(): number {
  const [width, setWidth] = useState(SSR_WIDTH);

  useEffect(() => {
    const measure = () => setWidth(window.innerWidth);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return width;
}

/**
 * 한 칸 배치와 두세 칸 배치를 가르는 경계.
 * 시안은 760 이지만 레이아웃 자체는 Tailwind `md:`(768)가 잡으므로 그쪽에 맞춘다 —
 * 8px 어긋나면 그 구간에서만 카드 폭과 단 수가 따로 논다.
 */
export const MOBILE_MAX = 768;
