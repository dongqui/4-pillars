/**
 * 로딩 화면의 진행률은 추정치다 — 서버는 LLM 생성이 얼마나 됐는지 알려주지 않는다.
 * 처음엔 빠르게, 갈수록 느리게 차고 PROGRESS_CAP 에서 멈춘다. 끝나지 않았는데
 * 100% 를 보이면 사용자는 멈춘 것으로 읽는다.
 */
export const PROGRESS_CAP = 0.92;

export function estimateProgress(elapsedMs: number, expectedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return PROGRESS_CAP * (1 - Math.exp((-2.5 * elapsedMs) / expectedMs));
}

export function activeStepIndex(progress: number, stepCount: number): number {
  return Math.min(stepCount - 1, Math.floor((progress / PROGRESS_CAP) * stepCount));
}

/**
 * 클릭 직후 overlay 와 도착 페이지의 Suspense fallback 은 서로 다른 인스턴스다.
 * overlay 가 시작 시각을 남기면 fallback 이 이어받아 진행 바가 0 으로 되돌아가지 않는다.
 */
export const HANDOFF_KEY = "loading:startedAt";
const HANDOFF_WINDOW_MS = 15_000;

export function resolveStartedAt(stored: string | null, now: number): number {
  if (stored === null) return now;
  const t = Number(stored);
  if (!Number.isFinite(t)) return now;
  const age = now - t;
  return age >= 0 && age < HANDOFF_WINDOW_MS ? t : now;
}
