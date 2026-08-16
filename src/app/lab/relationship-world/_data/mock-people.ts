import type { Feature, RelationRole } from "./roles";

export type MockPerson = {
  readonly id: string;
  readonly name: string;
  readonly pillarKey: string;
  readonly sceneName: string;
  readonly role: RelationRole;
  readonly feature: Feature;
};

export const SELF = {
  id: "self",
  name: "나",
  pillarKey: "갑자",
  sceneName: "깊은 물가의 큰나무",
} as const;

export const FRIENDS: readonly MockPerson[] = [
  // 나를 채워주는 사람 · 6
  { id: "f01", name: "민수", pillarKey: "정묘", sceneName: "풀숲에 깃든 등불", role: "fill", feature: "none" },
  { id: "f02", name: "지현", pillarKey: "신미", sceneName: "모래 속의 보석", role: "fill", feature: "yukhap" },
  { id: "f03", name: "태호", pillarKey: "을해", sceneName: "물안개 속 들꽃", role: "fill", feature: "none" },
  { id: "f04", name: "서연", pillarKey: "기묘", sceneName: "풀 돋은 들판", role: "fill", feature: "chung" },
  { id: "f05", name: "준영", pillarKey: "계미", sceneName: "마른 땅을 적시는 이슬", role: "fill", feature: "none" },
  { id: "f06", name: "하람", pillarKey: "정해", sceneName: "물 위에 뜬 등불", role: "fill", feature: "none" },

  // 나란히 서는 사람 · 5
  { id: "f07", name: "은채", pillarKey: "신묘", sceneName: "풀숲에 숨은 보석", role: "beside", feature: "yukhap" },
  { id: "f08", name: "도윤", pillarKey: "을미", sceneName: "마른 땅에 핀 들꽃", role: "beside", feature: "none" },
  { id: "f09", name: "가온", pillarKey: "기해", sceneName: "물길을 낸 들판", role: "beside", feature: "none" },
  { id: "f10", name: "선우", pillarKey: "계묘", sceneName: "풀잎 끝의 이슬", role: "beside", feature: "chung" },
  { id: "f11", name: "예린", pillarKey: "정미", sceneName: "들을 밝히는 등불", role: "beside", feature: "none" },

  // 나를 표현하게 하는 사람 · 4
  { id: "f12", name: "시우", pillarKey: "신해", sceneName: "맑은 물에 씻긴 보석", role: "express", feature: "yukhap" },
  { id: "f13", name: "나윤", pillarKey: "을묘", sceneName: "흐드러지게 핀 들꽃", role: "express", feature: "none" },
  { id: "f14", name: "건우", pillarKey: "기미", sceneName: "황금빛 들판", role: "express", feature: "none" },
  { id: "f15", name: "채원", pillarKey: "계해", sceneName: "바다로 가는 이슬", role: "express", feature: "chung" },

  // 나를 움직이게 하는 사람 · 3
  { id: "f16", name: "지호", pillarKey: "기사", sceneName: "온기가 스민 들판", role: "move", feature: "yukhap" },
  { id: "f17", name: "소율", pillarKey: "정축", sceneName: "새벽을 기다리는 등불", role: "move", feature: "none" },
  { id: "f18", name: "우진", pillarKey: "계사", sceneName: "볕을 머금은 이슬", role: "move", feature: "chung" },

  // 나를 다듬는 사람 · 2
  { id: "f19", name: "다인", pillarKey: "을사", sceneName: "모닥불 곁의 들꽃", role: "refine", feature: "yukhap" },
  { id: "f20", name: "현수", pillarKey: "갑자", sceneName: "깊은 물가의 큰나무", role: "refine", feature: "none" },
];
