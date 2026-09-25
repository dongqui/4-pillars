// 답변에 쓴 명리 전문용어 세기 — **측정 장치**다.
//
// 상한(답 전체 두 종류)은 프롬프트에만 있고, 여기서 막지 않는다. 초과했다고 답을
// 버리면 사용자는 오류만 보고 턴은 날아간다 — 용어 하나 때문에 치를 대가가 아니다.
// 그래서 세어서 기록만 하고, 실제로 얼마나 지켜지는지는 로그로 본다.
//
// 이 숫자가 0 이나 2 라고 해서 용어 남발이 해결됐다는 뜻은 아니다. 세는 것은 종류
// 수뿐이고, 그 용어가 이번 질문에 필요했는지는 사람이 본다.

/**
 * 셀 용어. 종류 단위로 센다 — 한 답에 "비견"이 세 번 나와도 하나다.
 *
 * `비겁`·`식상`·`재성`·`관성`·`인성` 은 묶음 이름이라 개별 십성과 따로 센다.
 * 사주·운세·연애운 같은 서비스 분야명은 넣지 않는다(제한 대상이 아니다).
 */
const TERMS = [
  "일간",
  "비견",
  "겁재",
  "비겁",
  "식신",
  "상관",
  "식상",
  "정재",
  "편재",
  "재성",
  "정관",
  "편관",
  "관성",
  "정인",
  "편인",
  "인성",
  "오행",
  "십성",
  "천간",
  "지지",
  "원국",
  "신강",
  "신약",
  "용신",
  "희신",
  "설기",
  "대운",
  "세운",
  "월운",
  "합충",
];

/**
 * 오행 한 글자는 그 자체로 흔한 말이라("금방", "수리비") 용어로 쓴 표기만 센다 —
 * 괄호 안에 오행만 적었거나("(금)", "(목·화)") "금 기운" 처럼 쓴 자리다.
 * 괄호 안에 문장이 들어 있으면 세지 않는다. 실제로 "(새 세입자가 안 구해졌다,
 * 수리비를 제하겠다는 등)" 을 용어로 세는 버그가 있었다.
 */
const ELEMENT_PARENS_RE = /[(（]\s*[목화토금수](\s*[·,、]\s*[목화토금수])*\s*[)）]/g;
const ELEMENT_ENERGY_RE = /(^|[^가-힣])[목화토금수]\s*기운/g;

export interface TermUsage {
  /** 쓰인 용어 종류 */
  terms: string[];
  /** 종류 수. 프롬프트가 권하는 상한은 2 다 */
  count: number;
}

export function countTerms(bubbles: string[]): TermUsage {
  const text = bubbles.join("\n");
  const found = new Set(TERMS.filter((t) => text.includes(t)));
  for (const m of text.match(ELEMENT_PARENS_RE) ?? []) found.add(m.trim());
  for (const m of text.match(ELEMENT_ENERGY_RE) ?? []) found.add(m.trim().replace(/^[^가-힣]+/, ""));
  const terms = [...found];
  return { terms, count: terms.length };
}
