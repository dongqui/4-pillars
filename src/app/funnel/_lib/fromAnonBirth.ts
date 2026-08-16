import type { LightBirthBody } from "@/lib/characters/anon";
import type { FunnelData } from "../_context/FunnelContext";

/**
 * 라이트 퍼널 입력 → 퍼널 초기값.
 *
 * 채우는 것은 캐릭터를 만들 때 실제로 받은 것뿐이다 — 이름·달력·윤달·생년월일.
 * 성별·시각·출생지는 물어본 적이 없으므로 비워 둔다(추측해서 채우면 리포트가 어긋난다).
 */
export function fromAnonBirth(body: LightBirthBody): Partial<FunnelData> {
  return {
    name: body.name ?? "",
    calendar: body.calendar,
    isLeapMonth: body.isLeapMonth,
    birth: { y: body.birth.year, m: body.birth.month, d: body.birth.day },
  };
}
