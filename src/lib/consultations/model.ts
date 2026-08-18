/**
 * 상담에 쓸 모델. 리포트(src/app/api/saju/_lib/generator.ts 의 MODEL)와 값이
 * 같더라도 상수를 따로 두는 이유는, 둘이 서로 모르게 갈릴 수 있어야 하기
 * 때문이다 — 리포트는 한 번 쓰고 오래 남는 글이고 상담은 짧은 대화 턴이라,
 * 한쪽만 내리고 싶은 날이 온다.
 */
export const CONSULT_MODEL = "deepseek-v4-pro";
