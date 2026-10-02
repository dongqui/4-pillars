export type LoadingStep = { label: string; sub: string };
export type LoadingPreset = {
  title: string;
  note: string;
  expectedMs: number;
  steps: LoadingStep[];
};
export type LoadingPresetKey = "report" | "match" | "flow" | "consult";

const FIRST_TIME = "처음 한 번만 조금 걸려요. 다음부터는 바로 열려요.";
const WRAP_UP: LoadingStep = { label: "마무리", sub: "읽기 좋은 순서로 정리하고 있어요" };

export const LOADING_PRESETS: Record<LoadingPresetKey, LoadingPreset> = {
  report: {
    title: "리포트를 쓰고 있어요",
    note: FIRST_TIME,
    expectedMs: 40_000,
    steps: [
      { label: "만세력 변환", sub: "생년월일시를 절기 기준으로 옮기고 있어요" },
      { label: "사주 여덟 글자 세우기", sub: "연주 · 월주 · 일주 · 시주" },
      { label: "오행과 십신 살피기", sub: "강한 기운과 부족한 기운을 찾고 있어요" },
      { label: "해석문 작성", sub: "성향 · 관계 · 재물 · 운의 흐름" },
      WRAP_UP,
    ],
  },
  match: {
    title: "궁합을 풀어보고 있어요",
    note: FIRST_TIME,
    expectedMs: 30_000,
    steps: [
      { label: "두 사람의 사주 세우기", sub: "각자의 여덟 글자를 펼치고 있어요" },
      { label: "오행 궁합 살피기", sub: "서로 채우는 기운과 부딪히는 기운" },
      { label: "관계 해석 작성", sub: "고른 관계에 맞춰 풀고 있어요" },
      WRAP_UP,
    ],
  },
  flow: {
    title: "흐름을 풀어보고 있어요",
    note: FIRST_TIME,
    expectedMs: 30_000,
    steps: [
      { label: "대운·세운 살피기", sub: "그해에 들어오는 기운을 겹쳐 보고 있어요" },
      { label: "월별 흐름 짚기", sub: "조심할 달과 잘 흐를 달" },
      { label: "해석문 작성", sub: "내 사주에 맞춰 풀고 있어요" },
      WRAP_UP,
    ],
  },
  consult: {
    title: "상담사가 사주를 읽고 있어요",
    note: "첫 답변을 쓰는 데 10초쯤 걸려요",
    expectedMs: 12_000,
    steps: [
      { label: "사주 읽기", sub: "원국을 펼치고 있어요" },
      { label: "고민 정리", sub: "적어 주신 내용을 짚고 있어요" },
      { label: "첫 답변 작성", sub: "곧 대화방으로 넘어가요" },
    ],
  },
};

export const LOADING_TIPS = [
  "사주는 태어난 순간의 기운을 여덟 글자로 옮긴 기록이에요. 정해진 운명이 아니라, 타고난 성향과 흐름을 읽는 지도에 가깝습니다.",
  "태어난 시간을 모르면 시주(時柱)를 세울 수 없어요. 시간을 아는 것만으로 해석의 정확도가 크게 올라갑니다.",
  "오행이 완벽하게 균형 잡힌 사주는 드물어요. 부족한 기운을 어떻게 채우는지가 사주 해석의 핵심입니다.",
  "대운은 10년 단위로 바뀌는 큰 흐름이에요. 같은 사주라도 지금 어느 대운에 있는지에 따라 다르게 읽힙니다.",
];
