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
 * ⚠️ 상한을 `.max(new Date().getFullYear())` 로 쓰면 안 된다. 그 식은 모듈이
 * 처음 import 될 때 딱 한 번 계산되어 상수로 굳는다. 서버 프로세스가 연말을
 * 넘겨 살아 있으면 클라이언트(add-draft.ts 는 호출마다 다시 읽는다)는 새해
 * 출생연도로 제출 버튼을 켜는데 서버는 그 값을 400 으로 뱉는다. 사용자에게는
 * 이유 없는 오류다. 그래서 refine 으로 **검증할 때마다** 다시 읽는다.
 *
 * 월·일은 범위만 본다. 2월 31일 같은 값은 여기를 통과하고 만세력이 걸러낸다
 * (to-map-people.ts 의 null) — 윤년·음력 규칙을 zod 에 두 벌로 적지 않는다.
 */
export const addPersonSchema = z.object({
  name: z.string().trim().min(1).max(20),
  calendar: z.enum(["solar", "lunar"]).default("solar"),
  isLeapMonth: z.boolean().default(false),
  birth: z.object({
    year: z
      .number()
      .int()
      .min(1900)
      .refine((y) => y <= new Date().getFullYear(), {
        message: "아직 오지 않은 해입니다",
      }),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
  }),
});

export type AddPersonBody = z.infer<typeof addPersonSchema>;
