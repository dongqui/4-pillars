import type { Feature, RelationRole } from "./roles";

/** 지도 위의 사람 하나. 생년월일은 담지 않는다 — 화면이 쓰지 않고, 남의 지도에 노출되어서도 안 된다. */
export type MapPerson = {
  readonly id: string;
  readonly name: string;
  /** 일주 한글 간지 (예: "경오") */
  readonly pillarKey: string;
  /** 일주 캐릭터의 장면명 (예: "한낮의 무쇠") */
  readonly sceneName: string;
  readonly role: RelationRole;
  readonly feature: Feature;
  /**
   * 일주가 통째로 같은가. saju-core 의 배지는 육합·충·동일일주 셋인데 지도의
   * Feature 는 셋(기본·六合·沖)뿐이라 동일일주가 갈 자리가 없다. 배치는 기본으로
   * 접고 이 사실만 따로 실어 상세 시트가 말한다.
   */
  readonly sameDayPillar: boolean;
};

/** 지도의 중심. 관계가 없으므로 role·feature 가 없다. */
export type MapCenter = {
  readonly name: string;
  readonly pillarKey: string;
  readonly sceneName: string;
};
