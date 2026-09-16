import { z } from "zod";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const DOMAIN = ["career", "money", "romance", "relationships"] as const;
const FOCUS = [...DOMAIN, "overall"] as const;
const SOURCE = ["overview", ...DOMAIN, "months"] as const; // closing 자기 참조는 enum 에서 막힌다

export type DomainKey = (typeof DOMAIN)[number];
export type FocusDomain = (typeof FOCUS)[number];

/** trim 뒤 길이(JS length). 프롬프트 문서 §6 "앞뒤 공백은 검증 전에 trim" */
const str = (min: number, max: number) => z.string().trim().min(min).max(max);
const unique = <T>(msg: string) => (arr: T[], ctx: z.RefinementCtx) => {
  if (new Set(arr).size !== arr.length) ctx.addIssue({ code: "custom", message: msg });
};
const basisRefs = z.array(z.string().trim().min(1).max(64)).min(1).max(6).superRefine(unique("basisRefs 중복"));
const monthIndex = z.union(MONTHS.map((n) => z.literal(n)) as [z.ZodLiteral<number>, z.ZodLiteral<number>, ...z.ZodLiteral<number>[]]);

const claim = z.object({ conclusion: str(1, 200), qualification: z.string().trim().max(160), basisRefs }).strict();
const monthLink = z.object({ monthIndex, note: str(1, 120) }).strict();
const domain = z.object({
  headline: str(15, 55), opportunity: str(1, 280), caution: str(1, 280), action: str(1, 160),
  monthLinks: z.array(monthLink).max(2).superRefine((arr, ctx) => {
    if (new Set(arr.map((m) => m.monthIndex)).size !== arr.length) ctx.addIssue({ code: "custom", message: "monthLinks 달 중복" });
  }),
  basisRefs,
}).strict();
const monthItem = z.object({
  monthIndex, headline: str(8, 45), focusDomain: z.enum(FOCUS), body: str(1, 360), action: str(1, 140), basisRefs,
}).strict();

export const flowReportV2Schema = z.object({
  interpretation: z.object({
    annual: claim, focusDomain: z.enum(FOCUS),
    domains: z.object({ career: claim, money: claim, romance: claim, relationships: claim }).strict(),
  }).strict(),
  sections: z.object({
    overview: z.object({ headline: str(15, 55), body: str(1, 600), basisRefs }).strict(),
    career: domain, money: domain, romance: domain, relationships: domain,
    months: z.object({
      lead: str(1, 240),
      items: z.array(monthItem).length(12).superRefine((arr, ctx) => {
        for (let i = 0; i < arr.length; i++) {
          if (arr[i].monthIndex !== i + 1) { ctx.addIssue({ code: "custom", message: "months.items 는 1..12 오름차순·유일" }); return; }
        }
      }),
    }).strict(),
    closing: z.object({
      items: z.array(z.object({
        title: str(6, 30), body: str(1, 180),
        sourceKeys: z.array(z.enum(SOURCE)).min(1).max(2).superRefine(unique("sourceKeys 중복")),
      }).strict()).length(3),
    }).strict(),
  }).strict(),
}).strict();

export type FlowReportV2 = z.infer<typeof flowReportV2Schema>;

/** tool parameters. $schema 는 지운다(v1 derive.ts 와 같은 처리). refine 은 JSON Schema 에 안 실린다 — 프롬프트 문장이 보완. */
export function flowReportToolSchema(): Record<string, unknown> {
  const s = z.toJSONSchema(flowReportV2Schema) as Record<string, unknown>;
  delete s.$schema;
  return s;
}
