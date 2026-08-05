import { FREE_SECTION_KEYS, SECTION_KEYS } from "@/app/api/saju/_lib/sections";
import type { ProfileRow } from "@/lib/profiles/store";

/**
 * 화면 문구의 숫자는 섹션 레지스트리에서 파생한다 — 섹션을 추가하거나 티어를
 * 바꿔도 "12개 중 4개 열림"이 저절로 따라간다.
 */
export const TOTAL_SECTIONS = SECTION_KEYS.length;
export const FREE_SECTIONS = FREE_SECTION_KEYS.length;

export interface ProfileCard {
  id: string;
  name: string;
  /** 아바타에 넣을 이름 첫 글자 */
  initial: string;
  /** "1990.10.25 · 오후 3시 20분" */
  birthLabel: string;
  isPaid: boolean;
  openedSections: number;
  totalSections: number;
  reportHref: string;
}

/** 0시 → "오전 12시", 12시 → "오후 12시". */
function timeLabel(hour: number, minute: number): string {
  const meridiem = hour < 12 ? "오전" : "오후";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${meridiem} ${h12}시 ${minute}분`;
}

export function toProfileCard(row: ProfileRow): ProfileCard {
  const { year, month, day } = row.birth;
  const date = `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
  // 음력을 표시하지 않으면 사용자가 자기가 입력한 날짜를 알아보지 못한다.
  const calendar = row.calendar === "lunar" ? " (음력)" : "";
  const time = row.time ? timeLabel(row.time.hour, row.time.minute) : "시간 모름";

  return {
    id: row.id,
    name: row.name,
    // 스프레드로 자르는 이유: 이모지·한자 확장 같은 서로게이트 쌍이 반으로 잘리지 않게.
    initial: [...row.name][0] ?? "?",
    birthLabel: `${date}${calendar} · ${time}`,
    isPaid: row.isPaid,
    openedSections: row.isPaid ? TOTAL_SECTIONS : FREE_SECTIONS,
    totalSections: TOTAL_SECTIONS,
    reportHref: `/report?profile=${row.id}`,
  };
}

export function countCaption(cards: ProfileCard[]): string {
  const paid = cards.filter((c) => c.isPaid).length;
  return `${cards.length}개 · 전체 리포트 ${paid}개`;
}
