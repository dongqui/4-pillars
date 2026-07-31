import { z } from "zod";

/**
 * POST /api/profiles 본문. 퍼널의 FunnelData 를 그대로 옮긴 모양이다.
 * saju API 의 parseRequest(수동 검증)와 달리 zod 를 쓰는 이유: 중첩 객체가 많고
 * 기본값이 필요해서, 손으로 쓰면 길이만 늘어난다.
 */
export const createProfileSchema = z.object({
  name: z.string().trim().min(1).max(20),
  gender: z.enum(["male", "female"]),
  calendar: z.enum(["solar", "lunar"]).default("solar"),
  isLeapMonth: z.boolean().default(false),
  birth: z.object({
    year: z.number().int().min(1900).max(2200),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
  }),
  timeKnown: z.boolean().default(true),
  time: z
    .object({
      hour: z.number().int().min(0).max(23),
      minute: z.number().int().min(0).max(59),
    })
    .nullable()
    .default(null),
  birthPlace: z
    .object({
      country: z.enum(["KR", "JP"]),
      regionId: z.string().min(1),
    })
    .nullable()
    .default(null),
  trueSolar: z.boolean().default(true),
});

export type CreateProfileBody = z.infer<typeof createProfileSchema>;
