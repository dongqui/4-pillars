import type { ConsultationListItem } from "@/lib/consultations/store";

export interface ConsultationEntry {
  id: string;
  title: string;
  preview: string;
  /** "3/10" 또는 "완료" */
  progress: string;
  /** "오늘" · "어제" · "8월 12일" */
  when: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * 서비스가 쓰는 표준시(UTC+9). 한국과 일본이 같은 오프셋이고 둘 다 서머타임이 없어서
 * 상수 하나로 두 시장을 덮는다 — 다른 오프셋의 시장이 열리면 그때 사용자별로 바꾼다.
 *
 * UTC 로 그냥 자르면 안 되는 이유: KST 00:00~08:59 는 UTC 로 전날이라, 오늘 아침에
 * 연 상담이 "어제"로 뜬다. 하루의 9시간이 걸리는 문제다.
 */
const SERVICE_UTC_OFFSET_HOURS = 9;

/** UTC 시각을 서비스 표준시로 옮긴다. 연/월/일을 그 지역 달력 기준으로 읽기 위한 용도로만 쓴다 */
function toServiceLocal(d: Date): Date {
  return new Date(d.getTime() + SERVICE_UTC_OFFSET_HOURS * HOUR_MS);
}

/** 자정(서비스 표준시) 기준으로 며칠 전인지. 시각 차가 아니라 날짜 차를 센다 */
function daysAgo(then: Date, now: Date): number {
  const t = toServiceLocal(then);
  const n = toServiceLocal(now);
  const a = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  const b = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  return Math.round((b - a) / DAY_MS);
}

/**
 * now 를 인자로 받는 이유: 안에서 new Date() 를 부르면 테스트가 시계에 묶인다.
 * 화면은 렌더 시점의 시각을 넘긴다.
 */
export function toListEntry(row: ConsultationListItem, now: Date): ConsultationEntry {
  const created = new Date(row.createdAt);
  const d = daysAgo(created, now);
  const createdLocal = toServiceLocal(created);

  return {
    id: row.id,
    // 첫 턴이 실패한 상담은 제목도 말풍선도 없다. 무제로 두면 목록에서
    // 빈 줄처럼 보이므로 재개할 수 있는 상담임을 알아볼 문구를 준다.
    title: row.title ?? "아직 시작하지 않은 상담",
    preview: row.lastBubble ?? "",
    progress: row.status === "closed" ? "완료" : `${row.turnsUsed}/${row.turnLimit}`,
    when:
      d === 0
        ? "오늘"
        : d === 1
          ? "어제"
          : `${createdLocal.getUTCMonth() + 1}월 ${createdLocal.getUTCDate()}일`,
  };
}
