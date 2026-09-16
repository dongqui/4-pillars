// v2 결과 화면의 섹션 메타·고정 문구. 화면(FlowBodyV2)과 테스트가 같은 출처를 본다.

export const V2_SECTIONS = [
  { key: "overview", no: "01", title: "총운" },
  { key: "career", no: "02", title: null }, // careerTitle 이 채운다
  { key: "money", no: "03", title: "재물운" },
  { key: "romance", no: "04", title: "연애운" },
  { key: "relationships", no: "05", title: "대인운" },
  { key: "months", no: "06", title: "월별 운세" },
  { key: "closing", no: "07", title: "이 해를 잘 보내는 법" },
] as const;

export const NO_PIVOT_COPY =
  "큰 전환점으로 따로 표시한 달은 없어요. 달마다 주의할 점은 아래에서 확인하세요.";

export const DISCLAIMER =
  "사주를 바탕으로 한 해석이에요. 실제 선택은 현재 상황과 확인 가능한 정보를 함께 살펴 결정해 주세요.";

export const REFERENCE_COPY = {
  current_baseline: "지금 상황을 참고했어요",
  selected_year_start: "선택한 해 초의 상황을 참고했어요",
  unspecified: null,
} as const;

export const CTA = {
  career: (profileId: string) => ({ href: `/consult?profile=${profileId}`, label: "내 상황 더 이야기하기" }),
  romance: () => ({ href: "/match", label: "궁합 보기" }),
  relationships: () => ({ href: "/map", label: "관계 지도 보기" }),
} as const;

export const monthAnchor = (i: number) => `month-${String(i).padStart(2, "0")}`;
