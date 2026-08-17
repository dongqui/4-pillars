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

/** 자정 기준으로 며칠 전인지. 시각 차가 아니라 날짜 차를 센다 */
function daysAgo(then: Date, now: Date): number {
  const a = Date.UTC(then.getUTCFullYear(), then.getUTCMonth(), then.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((b - a) / DAY_MS);
}

/**
 * now 를 인자로 받는 이유: 안에서 new Date() 를 부르면 테스트가 시계에 묶인다.
 * 화면은 렌더 시점의 시각을 넘긴다.
 */
export function toListEntry(row: ConsultationListItem, now: Date): ConsultationEntry {
  const created = new Date(row.createdAt);
  const d = daysAgo(created, now);

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
          : `${created.getUTCMonth() + 1}월 ${created.getUTCDate()}일`,
  };
}
