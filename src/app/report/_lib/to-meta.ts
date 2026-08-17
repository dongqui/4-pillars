import type { Chart } from "@/lib/saju-core";
import type { ReportSubject } from "./subject";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 히어로 상단 한 줄. "양력 1990.02.20 04:30 · 갑자일주"
 *
 * 날짜는 chart.solar 가 아니라 profile.birth 에서 온다 — 음력 입력은 chart 에서
 * 양력으로 환산돼 있어서, 그걸 쓰면 "음력" 라벨에 환산된 양력 날짜가 붙는다.
 * /home 카드도 입력값을 보여주므로 두 화면이 같은 날짜를 말해야 한다.
 * chart 를 받는 이유는 일주 하나다.
 */
export function toReportMeta(
  profile: ReportSubject,
  chart: Chart,
): { name: string; birthLine: string } {
  const { year, month, day } = profile.birth;
  const isLunar = profile.calendar === "lunar";
  const calendar = isLunar ? "음력" : "양력";
  const leap = isLunar && profile.isLeapMonth ? " 윤달" : "";
  // 시각을 00:00 으로 적으면 자시 출생으로 읽힌다. 모르면 통째로 뺀다.
  const time = profile.time ? ` ${pad(profile.time.hour)}:${pad(profile.time.minute)}` : "";

  return {
    name: profile.name,
    birthLine: `${calendar} ${year}.${pad(month)}.${pad(day)}${leap}${time} · ${chart.day.korean}일주`,
  };
}
