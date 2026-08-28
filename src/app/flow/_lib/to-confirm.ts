// 선택 화면의 연도 칸. 페이지는 조립만 하고 판정은 여기서 끝낸다.

export interface YearOption {
  year: number;
  /** 만 나이. 시안의 연도 칸에 붙는다 */
  age: number;
  tag: "지난" | "올해" | "다가올";
  /**
   * ⚠️ 행 존재가 아니라 **권한**이다.
   *
   * 행 존재로 판정하면 "결제 없이 열립니다" 라고 안내한 뒤 실제로 차감된다 —
   * CTA 를 눌러 행은 만들어졌는데 생성이 한도나 잔액에서 막힌 경우다.
   */
  owned: boolean;
  /** 이 해의 flows 행. 없으면 null */
  flowId: string | null;
}

export interface YearOptionsInput {
  /** 지금의 명리 연도. 달력 연도가 아니다 */
  currentYear: number;
  span: number;
  /** 이 사람의 명리 출생 연도(@/lib/flows/birth-year 의 sajuBirthYearOf). 달력 연도가 아니다 */
  birthYear: number;
  owned: Map<number, { flowId: string; entitled: boolean }>;
}

export function buildYearOptions(input: YearOptionsInput): YearOption[] {
  const out: YearOption[] = [];
  const seen = new Set<number>();

  const emit = (y: number) => {
    if (seen.has(y)) return;
    // 태어나기 전 해에는 대운이 없고 만 나이가 음수가 된다.
    if (y < input.birthYear) return;
    seen.add(y);
    const hit = input.owned.get(y);
    out.push({
      year: y,
      age: y - input.birthYear,
      tag: y === input.currentYear ? "올해" : y < input.currentYear ? "지난" : "다가올",
      owned: hit?.entitled ?? false,
      flowId: hit?.flowId ?? null,
    });
  };

  for (let y = input.currentYear - input.span; y <= input.currentYear + input.span; y += 1) {
    emit(y);
  }

  // ±span 창은 currentYear 를 따라 미끄러진다. 입춘이 지나 창이 옮겨가도
  // 이미 값을 치른 해가 칸에서 사라지면 안 된다 — /flow/[id] 로 돌아가는
  // 유일한 길이 이 그리드뿐이라, 칸이 없어지면 그 리포트는 영영 못 찾는다.
  // 구매 불가 카드로만 덧붙인다: owned 는 이미 UI 가 "다시 보기" 로 그려
  // start() 대신 기존 flowId 로 이동시킨다 — 이 창 밖 칸이 새 구매를
  // 제안하는 일은 없다.
  for (const [y, entry] of input.owned) {
    if (entry.entitled) emit(y);
  }

  out.sort((a, b) => a.year - b.year);
  return out;
}

/**
 * "2027년 2월 초부터 2028년 2월 초까지"
 *
 * 연도를 감추지 않는다 — 감추면 사용자가 구매한 범위를 이해하지 못한다. 반대로
 * 입춘의 정확한 시각은 내부 판정에만 쓰고 화면에는 "초" 로 눅인다.
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
