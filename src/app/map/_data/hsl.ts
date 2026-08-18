/**
 * HSL → hex. saju-colors 와 role-colors 가 공유한다.
 *
 * 두 곳에 같은 변환을 베껴 두면 한쪽만 고쳤을 때 같은 색이 다른 hex 로 나온다.
 * 색 공간 변환은 도메인 지식이 없는 순수 산수라 여기 따로 둘 이유가 충분하다.
 */
export type Hsl = { readonly h: number; readonly s: number; readonly l: number };

export function hslToHex({ h, s, l }: Hsl): string {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = light - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
