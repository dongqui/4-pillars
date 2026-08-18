import { z } from "zod";

/**
 * POST /api/maps/[share]/people 본문.
 *
 * profiles/input.ts 와 달리 성별·시각·출생지가 없다. 지도는 일주만 쓰고 일주는
 * 그 셋과 무관하므로(설계 §1.1), 안 쓰는 개인정보는 받지 않는다. zod 는 모르는
 * 키를 조용히 버리므로 누가 gender 를 보내도 저장까지 가지 않는다.
 *
 * 연도 상한이 2200 이 아니라 현재인 이유: 지도에 올라오는 사람은 이미 태어난
 * 사람이다(match/_lib/to-counterpart.ts:53 과 같은 판단). 하한 1900 은
 * profiles/input.ts:17 과 같다.
 *
 * 월·일은 범위만 본다. 2월 31일 같은 값은 여기를 통과하고 만세력이 걸러낸다
 * (to-map-people.ts 의 null) — 윤년·음력 규칙을 zod 에 두 벌로 적지 않는다.
 */
export const addPersonSchema = z.object({
  name: z.string().trim().min(1).max(20),
  calendar: z.enum(["solar", "lunar"]).default("solar"),
  isLeapMonth: z.boolean().default(false),
  birth: z.object({
    year: z.number().int().min(1900).max(new Date().getFullYear()),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
  }),
});

export type AddPersonBody = z.infer<typeof addPersonSchema>;
