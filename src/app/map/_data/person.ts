import type { Element } from "@/lib/saju-core";
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
  /**
   * 일간 오행. 상세 시트의 오행 다리 문장(relation-notes.ts)이 "내가 무슨
   * 오행인가"를 알아야 해서 싣는다. 오행은 5분류라, 이미 노출 중인 각 사람의
   * 일주(60분류)보다 훨씬 거친 정보다.
   */
  readonly element: Element;
};
