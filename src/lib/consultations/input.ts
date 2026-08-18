import { z } from "zod";

/**
 * 사용자 발화 한 번의 글자 수 상한.
 *
 * 이 값이 비용 상한의 첫 번째 자물쇠다 — 설계 문서 §5 의 "최악 30원" 계산이
 * 이 숫자를 전제로 서 있다. 클라이언트의 maxlength 는 편의일 뿐이고, 실제
 * 방어선은 서버의 이 검증이다.
 */
export const MAX_UTTERANCE_CHARS = 1000;

/**
 * trim 을 먼저 걸고 길이를 재는 순서가 중요하다. 뒤집으면 공백 1000자가
 * 통과한 뒤 빈 문자열이 되어 LLM 에 아무 말도 없는 턴이 나간다.
 */
export const utteranceSchema = z.object({
  text: z.string().trim().min(1).max(MAX_UTTERANCE_CHARS),
});

export type UtteranceBody = z.infer<typeof utteranceSchema>;
