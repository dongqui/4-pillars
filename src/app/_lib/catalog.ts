import { FEATURE_COST, FEATURE_IDS, type Feature } from "@/lib/tickets/features";
import { getPackage } from "@/lib/payments/pricing";

/**
 * 랜딩이 파는 것들의 목록. 숫자를 직접 적지 않는 것이 요점이다 —
 * 가격은 이용권 한 장 값(t1 패키지)에서, 유료 항목은 FEATURE_IDS 에서 파생된다.
 * 결제 쪽 표를 고치면 랜딩이 따라오거나 컴파일이 깨진다.
 */

/** 이용권 한 장 값. 화면에 "1,000원" 을 적어 두면 t1 가격을 바꿀 때 랜딩만 남는다. */
const TICKET_PRICE = getPackage("t1").amount;

/**
 * 1000 → "1,000원". checkout 의 formatKrw(₩ 접두) 와 표기가 다르고 그 파일은
 * 라우트 전용이라 가져오지 않는다 — 구분자 로직만 같은 방식으로 짧게 복제한다.
 * (toLocaleString 을 쓰지 않는 이유도 같다: 서버·브라우저가 다른 문자열을 낸다.)
 */
export function formatWon(won: number): string {
  return `${won.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}원`;
}

/** 히어로의 "개당 1,000원" 이 여기서 나온다. */
export const TICKET_PRICE_LABEL = formatWon(TICKET_PRICE);

export interface MenuItem {
  title: string;
  desc: string;
  /** 가격표에 찍히는 문구. 무료 항목은 "무료" 그대로다. */
  price: string;
  paid: boolean;
  href: string;
}

/**
 * 유료 항목은 Record<Feature, …> 다. features.ts 에 서비스를 추가하면 여기서
 * 컴파일이 깨진다 — 랜딩에 없는 상품이 조용히 팔리는 일을 막는다.
 * 값(제목·설명)만 여기 있고 가격은 FEATURE_COST × 장당 가격으로 계산한다.
 */
const PAID: Record<Feature, { title: string; desc: string; href: string }> = {
  full_report: {
    title: "성향 리포트",
    desc: "기질과 사고방식, 강점과 성장 포인트. 올해의 흐름과 잘 맞는 환경까지 한 번에 열려요.",
    href: "/report",
  },
  compatibility: {
    title: "두 사람 궁합",
    desc: "한 관계를 자세히 들여다봅니다.",
    href: "/match",
  },
  consultation: {
    title: "고민상담",
    desc: "털어놓고 싶은 이야기, 사주를 아는 상대와 나눠보세요.",
    href: "/consult",
  },
};

/** 무료 항목. 이용권을 쓰지 않는 것만 여기 있다. */
const FREE: MenuItem[] = [
  {
    title: "내 캐릭터",
    desc: "60가지 중 나는 어떤 사람인지.",
    price: "무료",
    paid: false,
    href: "/funnel?step=name",
  },
  {
    title: "관계 지도",
    desc: "주변 사람이 나에게 어떤 역할인지. 몇 명이든.",
    price: "무료",
    paid: false,
    href: "/map",
  },
];

/** 무료 먼저, 그다음 FEATURE_IDS 순서대로. */
export const MENU_ITEMS: MenuItem[] = [
  ...FREE,
  ...FEATURE_IDS.map((id) => ({
    ...PAID[id],
    price: formatWon(FEATURE_COST[id] * TICKET_PRICE),
    paid: true,
  })),
];
