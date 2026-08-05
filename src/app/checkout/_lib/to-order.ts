import type { ProfileRow } from "@/lib/profiles/store";

/** 주문 요약에 보이는 결제 대상 한 줄. */
export interface OrderTarget {
  /** 아바타에 들어가는 이름 첫 글자 */
  initial: string;
  /** "이정숙 (1963.04.12)" */
  label: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 프로필 → 주문 요약 표시값.
 *
 * 날짜는 chart 가 아니라 profile.birth 에서 온다 — 음력 입력은 chart 에서 양력으로
 * 환산돼 있어서, 그걸 쓰면 사용자가 입력한 날짜와 결제 화면의 날짜가 달라진다
 * (toReportMeta 와 같은 이유). 여기서는 양력/음력 라벨 없이 날짜만 보여준다.
 *
 * 디자인의 "어머니 · 이정숙"에서 관계는 뺐다 — profiles 에 관계 컬럼이 없다.
 */
export function toOrderTarget(profile: ProfileRow): OrderTarget {
  const { year, month, day } = profile.birth;
  const name = profile.name.trim();
  return {
    // 빈 이름은 DB 제약이 막지만, 막히지 않은 값이 아바타를 통째로 비우게 두지 않는다.
    initial: Array.from(name)[0] ?? "?",
    label: `${name} (${year}.${pad(month)}.${pad(day)})`,
  };
}
