/**
 * 관계 지도의 평면 배치.
 *
 * 좌표를 정하는 것은 전부 여기다. three 를 import 하지 않는다 — 이 라우트의
 * 테스트는 node 환경이라, 화면에서 겹치는지를 재려면 계산이 브라우저 밖에
 * 있어야 한다. 직전 설계(구면 앵커 + 재시도 샘플링)가 "3D 로는 떨어져 있어도
 * 화면에서는 겹친다"는 함정을 두 층에서 겪은 것이 이 규칙의 이유다.
 *
 * 각도는 12시가 0, 시계방향이 + 다. 좌표 변환은 아래 at() 하나뿐이고 이 파일
 * 밖에서 다시 정의하지 않는다.
 */
import { ROLE_ORDER, type Feature, type RelationRole } from "../_data/roles";

const deg = (d: number) => (d * Math.PI) / 180;

/** 구역 하나가 차지하는 각도. 다섯이 원을 채운다. */
export const SECTOR_SPAN = (2 * Math.PI) / 5;

/**
 * 그중 실제로 사람을 놓는 각도. 남는 16° 가 구역 사이 여백이다 —
 * 이 여백이 없으면 다섯 색이 경계에서 섞여 "어느 구역인가"가 흐려진다.
 */
export const SECTOR_USED = deg(56);

/**
 * 사람이 있는 칸이 보장받는 최소 **쓸 수 있는** 각도 폭. 한 명뿐인 칸도 자기
 * 자리를 갖는다.
 *
 * 배분되는 폭이 아니라 여백을 뺀 뒤의 폭이다 — 배치가 실제로 쓰는 값이
 * slot.half 이므로 하한도 거기 걸어야 뜻이 하나로 남는다. 그래서 배분할 때는
 * 칸마다 MIN_SLOT + 2·SLOT_MARGIN 을 먼저 떼어 둔다(세 칸이 다 차도 30° 라
 * SECTOR_USED 56° 안이다).
 */
export const MIN_SLOT = deg(8);

/** 슬롯 양끝에서 떼는 여백. 이웃 슬롯의 끝 사람과 붙지 않게 한다. */
export const SLOT_MARGIN = deg(1);

/** 한 칸이 소유하는 각도 구간. center 는 12시 기준 절대 각도가 아니라 구역 안 상대각이다. */
export type Slot = { readonly center: number; readonly half: number };

export type CellCounts = Record<RelationRole, Record<Feature, number>>;

/** 각도 순서. 사람이 가장 많은 기본이 구역 한가운데 오고 드문 둘이 양옆에 선다. */
const FEATURE_ORDER: readonly Feature[] = ["yukhap", "none", "chung"];

/** 구역 중심각. ROLE_ORDER 순서 그대로 12시부터 시계방향이다. */
export function sectorAngle(role: RelationRole): number {
  return SECTOR_SPAN * ROLE_ORDER.indexOf(role);
}

/**
 * 한 구역의 56° 를 세 칸에 나눈다.
 *
 * 사람이 있는 칸에 MIN_SLOT 을 먼저 주고, 남은 각도를 인원수 비례로 더한다.
 * 빈 칸은 0 이다 — 아무도 없는 칸이 자리를 차지하면 있는 칸이 그만큼 좁아진다.
 */
export function allocateSlots(
  counts: Record<Feature, number>,
): Record<Feature, Slot | null> {
  const live = FEATURE_ORDER.filter((f) => counts[f] > 0);
  const out = { yukhap: null, none: null, chung: null } as Record<Feature, Slot | null>;
  if (live.length === 0) return out;

  const total = live.reduce((sum, f) => sum + counts[f], 0);
  // 여백은 폭에서 깎이는 것이 아니라 미리 떼어 두는 것이다 — 그래야 남은
  // 폭(slot.half × 2)이 MIN_SLOT 아래로 내려가지 않는다.
  const floor = MIN_SLOT + 2 * SLOT_MARGIN;
  const extra = SECTOR_USED - floor * live.length;

  let cursor = -SECTOR_USED / 2;
  for (const f of FEATURE_ORDER) {
    if (counts[f] === 0) continue;
    const width = floor + extra * (counts[f] / total);
    out[f] = { center: cursor + width / 2, half: Math.max(0, width / 2 - SLOT_MARGIN) };
    cursor += width;
  }
  return out;
}
