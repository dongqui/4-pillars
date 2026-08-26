import type { FlowSegment } from "@/app/api/flows/_lib/segments";

/**
 * 읽는 시점이 속한 구간의 인덱스.
 *
 * segments 의 start/end 는 jsonb 안에서 ISO 문자열이다. 비교 전에 instant 로
 * 되돌린다 — 문자열끼리 비교하면 대부분 맞다가 오프셋 표기가 다른 행에서 틀린다.
 *
 * 못 찾으면 마지막 칸이다. period_end 를 지난 뒤에도 산 리포트는 계속 볼 수 있어야
 * 하고, 그때는 "이 흐름은 지났습니다 — 새 흐름 보기" 로 안내한다.
 */
export function currentSegmentIndex(segments: FlowSegment[], now: Date): number {
  const at = now.getTime();
  const found = segments.findIndex(
    (s) => at >= Date.parse(s.start) && at < Date.parse(s.end),
  );
  if (found >= 0) return found;
  return at < Date.parse(segments[0].start) ? 0 : segments.length - 1;
}

/**
 * "8월 무렵부터" — 계산된 날짜에서 붙인다. LLM 은 시점을 쓰지 않는다.
 * 정확한 절기 시각은 내부 판정에만 쓰고 화면에서는 달까지만 말한다.
 */
export function segmentLabel(segment: FlowSegment): string {
  const kst = new Date(Date.parse(segment.start) + 9 * 3600_000);
  return `${kst.getUTCMonth() + 1}월 무렵부터`;
}
