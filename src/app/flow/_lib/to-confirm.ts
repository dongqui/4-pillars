// 확인 화면의 상태. 페이지는 조립만 하고 판정은 여기서 끝낸다.

export interface ConfirmInput {
  profile: { id: string; name: string } | null;
  period: { start: Date; end: Date };
  /** 이 프로필·이 해의 flows 행. 없으면 null */
  existing: { id: string } | null;
  /** 그 행에 대한 열람 권한이 있는가. ⚠️ 행 존재와 다른 값이다 */
  owned: boolean;
}

export type ConfirmState =
  | { kind: "no_profile" }
  | { kind: "new"; profileId: string; profileName: string; periodStart: Date; periodEnd: Date }
  | { kind: "owned"; flowId: string; profileName: string; periodStart: Date; periodEnd: Date };

/**
 * ⚠️ owned 는 existing 이 아니라 entitlements 에서 온다.
 *
 * 행 존재로 판정하면 "이용권을 추가로 사용하지 않습니다" 라고 안내한 뒤 실제로
 * 차감된다 — CTA 를 눌러 행은 만들어졌는데 생성이 한도나 잔액에서 막힌 경우다.
 */
export function toConfirmState(input: ConfirmInput): ConfirmState {
  if (!input.profile) return { kind: "no_profile" };

  const common = {
    profileName: input.profile.name,
    periodStart: input.period.start,
    periodEnd: input.period.end,
  };

  if (input.existing && input.owned) {
    return { kind: "owned", flowId: input.existing.id, ...common };
  }
  return { kind: "new", profileId: input.profile.id, ...common };
}

/**
 * "2026년 2월 초부터 2027년 2월 초까지"
 *
 * 연도를 감추지 않는다 — 감추면 사용자가 구매한 범위와 다음 결제 시점을 이해하지
 * 못한다. 반대로 입춘의 정확한 시각은 내부 판정에만 쓰고 화면에는 "초" 로 눅인다.
 */
export function formatPeriod(start: Date, end: Date): string {
  const label = (d: Date) => {
    const kst = new Date(d.getTime() + 9 * 3600_000);
    const day = kst.getUTCDate();
    const phase = day <= 10 ? "초" : day <= 20 ? "중순" : "말";
    return `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월 ${phase}`;
  };
  return `${label(start)}부터 ${label(end)}까지`;
}
