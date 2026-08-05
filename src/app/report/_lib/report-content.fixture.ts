// /report 데모 화면이 그리는 샘플. 문구는 프롬프트(sections/registry.ts)가 뽑아낼
// 결과와 같은 규칙을 따른다 — personality 와 evidence(근거 차트)에서만 사주 용어를 쓰고,
// 나머지 섹션은 용어 없이 쉬운 말로 쓴다.

import type { ReportContent } from "./report-content";
import { EVIDENCE_DISCLAIMER } from "./evidence";

export const sampleReport: ReportContent = {
  meta: { name: "홍길동", birthLine: "양력 1990.02.20 04:30 · 갑자일주" },
  headline: "겉으로는 차분하지만, 자신만의 기준과 승부욕이 강한 사람",
  summary: "사람들과 잘 어울리지만, 혼자 생각을 정리하는 시간이 꼭 필요한 타입이에요.",
  keywords: ["신중한 관찰자", "독립적인 판단", "강한 책임감", "느린 속마음", "오래 밀고 나감"],
  personality: [
    { title: "신중한 관찰자", body: "일간 갑목이 인월의 단단한 뿌리 위에 서 있어, 상황을 먼저 파악한 뒤 움직이는 힘이 강해요. 말보다 판단이 앞서는 이유예요." },
    { title: "독립적인 판단", body: "비견이 두 개로 자기 기준이 뚜렷해요. 남의 의견은 듣지만, 최종 결정은 스스로 내려야 마음이 편한 편이에요." },
    { title: "한번 정하면 오래 밀고 나감", body: "정인이 일간을 꾸준히 받쳐주는 구조라, 방향이 정해지면 쉽게 흔들리지 않아요. 다만 방향을 정하기까지가 오래 걸리죠." },
  ],
  evidence: {
    pillars: [
      { slot: "hour", stem: { char: "丙", ko: "병", element: "fire", tenGod: "식신" }, branch: { char: "寅", ko: "인", element: "wood", tenGod: "비견" } },
      { slot: "day", isDayMaster: true, stem: { char: "甲", ko: "갑", element: "wood", tenGod: "일간 · 我" }, branch: { char: "子", ko: "자", element: "water", tenGod: "정인" } },
      { slot: "month", stem: { char: "戊", ko: "무", element: "earth", tenGod: "편재" }, branch: { char: "寅", ko: "인", element: "wood", tenGod: "비견" } },
      { slot: "year", stem: { char: "庚", ko: "경", element: "metal", tenGod: "편관" }, branch: { char: "午", ko: "오", element: "fire", tenGod: "상관" } },
    ],
    elements: [
      { element: "wood", count: 3, max: 3 },
      { element: "fire", count: 2, max: 3 },
      { element: "earth", count: 1, max: 3 },
      { element: "metal", count: 1, max: 3 },
      { element: "water", count: 1, max: 3 },
    ],
    yinYang: { yang: 5, yin: 3 },
    strength: { level: "신강", percent: 62 },
    tags: [
      { label: "비견 ×2", tone: "neutral" }, { label: "식신", tone: "neutral" },
      { label: "편재", tone: "neutral" }, { label: "편관", tone: "neutral" },
      { label: "정인", tone: "neutral" }, { label: "상관", tone: "neutral" },
      { label: "용신 · 금 金", tone: "metal" }, { label: "희신 · 화 火", tone: "fire" },
      { label: "역마살", tone: "accent" }, { label: "화개살", tone: "accent" },
    ],
    daeunStrip: [
      { gan: "甲申", age: "12–21세" }, { gan: "乙酉", age: "22–31세" },
      { gan: "丙戌", age: "32–41세", now: true }, { gan: "丁亥", age: "42–51세" },
      { gan: "戊子", age: "52–61세" }, { gan: "己丑", age: "62–71세" },
    ],
    // 실제 화면과 같은 문구를 쓴다. 여기 문자열을 따로 두면 둘이 조용히 어긋난다.
    disclaimer: EVIDENCE_DISCLAIMER,
  },
  outerVsInner: {
    outward: "침착하고 단단한 사람. 감정 기복이 적고, 맡은 일은 조용히 끝까지 해내는 믿음직한 인상을 줘요.",
    inner: "관계와 선택을 오래 고민하는 편. 결정 전에 수많은 경우의 수를 혼자 돌려보느라, 겉보다 속이 훨씬 바빠요.",
  },
  strengths: [
    { title: "복잡한 상황의 핵심을 빠르게 파악해요", body: "회의가 산으로 갈 때 \"그래서 결정할 건 이거죠\"라고 정리하는 쪽이에요." },
    { title: "쉽게 흔들리지 않고 끝까지 책임져요", body: "중간에 상황이 나빠져도 맡은 몫은 마무리하고 나오는 타입이에요." },
    { title: "사람의 분위기와 감정을 잘 읽어요", body: "말하지 않아도 상대의 컨디션 변화를 먼저 알아차리는 경우가 많아요." },
  ],
  cautions: [
    "충분히 잘하고 있어도 스스로 만족하지 못할 수 있어요. 기준이 늘 자기 자신이라, 남의 인정이 와도 잘 안 쌓여요.",
    "싫은 것을 바로 말하지 않고 참다가, 어느 순간 한 번에 거리를 두는 경향이 있어요. 상대는 이유를 모른 채 멀어졌다고 느낄 수 있어요.",
  ],
  cautionTip: "완벽하게 정리된 뒤 말하려 하기보다, 생각이 절반쯤 정리됐을 때 먼저 표현해 보세요. 관계도 일도 훨씬 가벼워져요.",
  emotion: [
    { label: "스트레스가 쌓이는 상황", body: "내 뜻대로 할 수 없는 상황이 계속될 때. 특히 결정권 없이 책임만 지는 구조에서 크게 소모돼요." },
    { label: "감정을 처리하는 방식", body: "즉시 표현하기보다 일단 안으로 접어두는 편. 정리가 끝난 뒤에야 담담하게 말로 꺼내요." },
    { label: "회복에 필요한 환경", body: "혼자 생각을 정리할 시간과 명확한 선택권. 이 둘이 주어지면 회복이 빠른 편이에요." },
    { label: "힘들 때 보이는 신호", body: "말수가 줄고 약속을 미뤄요. 연락이 뜸해지면 화난 게 아니라 정리 중일 가능성이 높아요." },
  ],
  relating: [
    { label: "처음 만날 때", value: "거리를 두고 관찰부터. 먼저 다가가기보다 상대를 파악한 뒤 마음을 열어요." },
    { label: "가까워지는 방식", value: "한 번에 훅 가까워지기보다, 신뢰가 쌓일 때마다 한 단계씩 깊어져요." },
    { label: "신뢰의 기준", value: "말보다 행동의 일관성. 약속을 지키는 사람에게만 속마음을 보여줘요." },
    { label: "갈등이 생기면", value: "그 자리에서 부딪히기보다 시간을 두고 정리한 뒤 대화를 시도해요." },
    { label: "애정 표현", value: "말보다 챙김으로. 기억해뒀다가 필요한 걸 먼저 해주는 방식이에요." },
  ],
  environment: {
    energizing: [
      "방법은 맡기고 결과로 평가하는 팀",
      "혼자 깊게 파고들 시간이 확보되는 일정",
      "전문성이 쌓이면 역할이 커지는 구조",
      "갈등을 대화로 정리하는 조직 문화",
    ],
    draining: [
      "과정을 자주 보고해야 하는 관리 방식",
      "방향이 수시로 뒤집히는 프로젝트",
      "즉흥적인 판단과 즉답을 요구하는 회의",
      "감정으로 압박이 오는 상하 관계",
    ],
    summary: "정해진 방식만 반복하는 환경보다, 스스로 판단하고 개선할 여지가 있는 환경에서 능력이 잘 드러나요.",
    emphasis: "스스로 판단하고 개선할 여지가 있는 환경",
  },
  love: [
    { label: "관계가 시작될 때", body: "호감이 있어도 먼저 표현하지 않는 편. 상대가 다가와야 마음을 확인하고 움직여요." },
    { label: "깊어지는 과정", body: "천천히, 그러나 한번 마음을 열면 오래 가요. 얕은 만남을 여러 번 하기보다 깊은 관계 하나를 택하는 유형이에요." },
    { label: "반복되는 갈등 지점", body: "서운함을 말하지 않고 쌓아두다 한 번에 터지는 패턴. 상대는 갑작스럽다고 느끼기 쉬워요." },
    { label: "관계가 끝난 뒤", body: "미련을 오래 두기보다 스스로 정리한 뒤 깔끔하게 끝내요. 다만 정리까지의 시간이 긴 편이에요." },
  ],
  compatibility: {
    good: ["말과 행동이 일치하고 약속을 지키는 사람", "혼자만의 시간을 존중해 주는 사람", "감정보다 대화로 갈등을 푸는 사람"],
    clash: ["즉흥적으로 계획을 바꾸는 사람", "감정을 즉시 표출하고 즉답을 요구하는 사람", "사생활의 경계를 자주 넘는 사람"],
  },
  wealth: {
    points: [
      { label: "돈이 모이는 방식", body: "한 번에 크게 벌기보다 꾸준히 쌓는 구조가 맞아요. 전문성이 깊어질수록 수입이 계단식으로 올라가는 흐름이에요." },
      { label: "새어나가는 지점", body: "평소엔 아끼다가 스트레스가 쌓였을 때 한 번에 크게 쓰는 패턴. 지출의 총량보다 타이밍이 문제예요." },
    ],
    summary: "투자는 단기 매매보다 긴 호흡의 적립식이 타고난 성향과 잘 맞아요.",
    emphasis: "긴 호흡의 적립식",
  },
  yearlyLuck: [
    { period: "8월", title: "정리", desc: "미뤄둔 결정을 끝내기 좋은 달. 벌이기보다 마무리가 유리해요." },
    { period: "9월", title: "전환", desc: "흐름이 바뀌는 달. 작은 변화의 신호를 놓치지 마세요." },
    { period: "10월", title: "인연", desc: "새 사람과 제안이 들어와요. 만남을 피하지 않는 게 좋아요." },
    { period: "11월", title: "연결", desc: "관계에서 시작된 기회가 일로 이어지는 흐름이에요." },
    { period: "12월", title: "준비", desc: "내년 상반기를 설계하는 달. 계획을 구체화하세요." },
    { period: "2027년 1월", title: "시동", desc: "운이 오르기 시작해요. 준비한 일을 꺼내기 좋은 타이밍이에요." },
    { period: "2월", title: "상승", desc: "한 해 중 가장 운이 강한 구간의 시작. 새로운 시도는 지금." },
    { period: "3월", title: "확장", desc: "벌인 일이 커지는 달. 다만 계약과 문서는 꼼꼼히 확인하세요." },
    { period: "4월", title: "성과", desc: "상반기 노력의 결과가 눈에 보이기 시작해요." },
    { period: "5월", title: "조정", desc: "속도를 한 템포 줄이는 달. 무리한 확장보다 다지기가 유리해요." },
    { period: "6월", title: "점검", desc: "건강과 체력을 챙길 때. 컨디션 관리가 운을 지켜요." },
    { period: "7월", title: "수확", desc: "1년의 흐름을 정리하고 성과를 거두는 달이에요." },
  ],
  daeunOutlook: {
    rows: [
      // range 는 화면이 계산해 붙이는 라벨이다 (to-report-content.ts: `${startAge}–${startAge+9}세`).
      // 위 daeunStrip 의 현재 구간(32–41세)과 같은 자리를 now 로 표시한다.
      { range: "32–41세", title: "기반을 쌓는 시기", desc: "실력과 신뢰를 축적하는 구간이에요. 눈에 띄는 성과보다 토대가 만들어지는 시기예요.", now: true },
      { range: "42–51세", title: "쌓은 것이 드러나는 시기", desc: "축적된 역량이 인정과 성과로 전환돼요. 역할과 위치가 크게 바뀔 수 있는 구간이에요." },
      { range: "52–61세", title: "확장과 안정의 시기", desc: "이룬 것을 넓히고 지키는 흐름. 돈이 가장 안정적으로 자리 잡는 구간이에요." },
    ],
    summary: "지금은 기반을 쌓는 구간의 후반부예요. 앞으로의 선택이 다음 구간의 방향을 정해요.",
    emphasis: "기반을 쌓는 구간의 후반부",
  },
};

/** 무료 사용자용 05–12 잠금 목록 (Saju Result.dc.html L233–290) */
export const lockedSections: import("./report-content").LockedSectionMeta[] = [
  { no: "05", category: "감정과 스트레스", title: "힘들 때 이런 패턴이 나타나요" },
  { no: "06", category: "사람을 대하는 방식", title: "관계에서의 나" },
  { no: "07", category: "잘 맞는 환경", title: "능력이 잘 드러나는 조건" },
  { no: "08", category: "연애와 관계", title: "연애할 때 반복되는 관계 패턴" },
  { no: "09", category: "궁합", title: "당신과 잘 맞는 사람의 특징" },
  { no: "10", category: "재물", title: "돈이 모이는 방식과 새어나가는 지점" },
  { no: "11", category: "올해의 운", title: "지금부터 1년, 나의 운의 흐름" },
  { no: "12", category: "10년 단위 흐름", title: "앞으로 10년의 큰 운 흐름" },
];
