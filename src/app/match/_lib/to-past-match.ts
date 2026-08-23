import { RELATION_TYPES, type RelationInput } from "@/lib/matches/relation-types";
import type { MatchListRow } from "@/lib/matches/store";

/** '이미 본 궁합' 카드 한 장이 그리는 것 전부. */
export interface PastMatchView {
  id: string;
  /** "곽희경 × 백상현" */
  pair: string;
  subjectInitial: string;
  counterpartInitial: string;
  /** 관계 배지. 유형을 모르는 옛 행이면 null — 배지 자체를 그리지 않는다. */
  relationLabel: string | null;
  /** "8월 18일" · 해가 다르면 "2025.08.18". 날짜를 못 읽으면 빈 문자열. */
  dateLabel: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 이름이 비어 있어도 아바타를 비우지 않는다 (to-person-option.ts 와 같은 판단). */
const initialOf = (name: string) => Array.from(name.trim())[0] ?? "?";

/**
 * 배지 문구.
 *
 * '기타'(custom)는 유형 라벨이 아니라 사용자가 적은 두 역할을 보여준다 — 목록에
 * '기타' 만 여러 줄 늘어서면 어느 것이 어느 관계였는지 구분할 수 없다.
 *
 * 유형이 null 인 행은 배지를 생략한다. 이 앱에서 관계 유형은 안 골라도 되므로
 * null 은 "지워진 옛 유형" 만이 아니라 "안 고름" 이기도 하다 — 어느 쪽이든
 * 보여줄 이름이 없다. "기타" 로 접으면 진짜 '기타' 와 섞여 두 사실이 한 라벨을 쓴다.
 */
function relationLabelOf(relation: RelationInput): string | null {
  if (relation.type === null) return null;
  const subject = (relation.subjectRole ?? "").trim();
  const counterpart = (relation.counterpartRole ?? "").trim();
  if (relation.type === "custom" && subject !== "" && counterpart !== "") {
    return `${subject}-${counterpart}`;
  }
  return RELATION_TYPES[relation.type].label;
}

/**
 * 같은 해면 "8월 18일", 아니면 "2025.08.18".
 *
 * now 를 주입받는 이유는 to-counterpart.ts 의 currentYear 와 같다 — 시스템 시계에
 * 테스트가 매이면 해가 바뀔 때 조용히 깨진다.
 */
function dateLabelOf(createdAt: string, now: Date): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  if (d.getFullYear() !== now.getFullYear()) {
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  }
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function toPastMatchView(row: MatchListRow, now: Date = new Date()): PastMatchView {
  const subject = row.subjectName.trim();
  const counterpart = row.counterpartName.trim();
  return {
    id: row.id,
    pair: `${subject} × ${counterpart}`,
    subjectInitial: initialOf(subject),
    counterpartInitial: initialOf(counterpart),
    relationLabel: relationLabelOf(row.relation),
    dateLabel: dateLabelOf(row.createdAt, now),
  };
}
