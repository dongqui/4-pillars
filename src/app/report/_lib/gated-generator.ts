import { checkAnonReportLimit, ReportRateLimitError } from "@/lib/reports/rate-limit";
import type { InterpretationGenerator } from "@/app/api/saju/_lib/types";

/**
 * 비로그인 생성에만 한도를 씌운 생성기.
 *
 * 게이트를 생성기 자리에 두는 이유: produceSections 는 캐시에 없는 섹션이 있을 때만
 * 생성기를 부른다. 그래서 이 자리에 두면 **실제로 비용이 드는 순간에만** 카운터가
 * 깎인다 — 캐시 히트는 세지 않는다. 페이지에서 미리 세면 이미 만들어 둔 리포트를
 * 다시 여는 것만으로 자기 한도를 소진한다.
 *
 * 로그인 사용자에게는 씌우지 않는다. 계정당 프로필 20개(MAX_PROFILES)와 OAuth 가
 * 이미 상한이고, 결제까지 가는 사람을 여기서 막을 이유가 없다.
 */
export function gateAnonGeneration(
  inner: InterpretationGenerator,
  ip: string,
): InterpretationGenerator {
  return {
    // 모델 식별자는 그대로 넘긴다 — DB 에 기록되는 값이라 래퍼가 바꾸면 안 된다.
    model: inner.model,
    async generateSections(analysis, keys, ctx) {
      if (!(await checkAnonReportLimit(ip))) throw new ReportRateLimitError();
      return inner.generateSections(analysis, keys, ctx);
    },
  };
}

/**
 * produceSections 는 생성기 예외를 GenerationError 로 감싸며 원인을 cause 에 넣는다.
 * 한도에 걸린 것과 생성이 실패한 것은 사용자에게 할 말이 다르므로 여기서 갈라낸다.
 */
export function isRateLimited(e: unknown): boolean {
  if (e instanceof ReportRateLimitError) return true;
  return e instanceof Error && e.cause instanceof ReportRateLimitError;
}
