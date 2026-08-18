import { addPersonSchema } from "@/lib/maps/input";
import {
  DuplicatePersonError,
  MapPeopleLimitError,
  type BirthLite,
  type MapPersonRow,
  type MapRow,
} from "@/lib/maps/store";
import { dayPillarOf, toMapPerson } from "@/app/map/_lib/to-map-people";

export interface AddDeps {
  findMap: () => Promise<MapRow | null>;
  add: (mapId: string, person: BirthLite & { name: string }) => Promise<MapPersonRow>;
}

export interface HandlerResult {
  status: number;
  body: unknown;
}

/**
 * 사람 추가. **로그인을 보지 않는다** — 링크를 가진 누구나 추가할 수 있다는 것이
 * 이 기능의 전부다.
 *
 * 응답에 생년월일을 담지 않는다. 담으면 남의 지도를 연 사람이 거기 있는 모든
 * 사람의 생일을 읽게 된다. 화면이 쓰는 것은 이름·일주·구역뿐이다.
 */
export async function handleAddPerson(raw: unknown, deps: AddDeps): Promise<HandlerResult> {
  const map = await deps.findMap();
  if (!map) return { status: 404, body: { error: "지도를 찾을 수 없습니다" } };

  const parsed = addPersonSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 400, body: { error: "이름과 생년월일을 확인해 주세요" } };
  }

  const input = {
    name: parsed.data.name,
    year: parsed.data.birth.year,
    month: parsed.data.birth.month,
    day: parsed.data.birth.day,
    calendar: parsed.data.calendar,
    isLeapMonth: parsed.data.isLeapMonth,
  };

  // 스키마는 범위만 본다. 2월 31일이나 없는 윤달은 여기서 걸린다 — 저장한 뒤
  // 화면에서 조용히 사라지는 것보다 지금 거절하는 편이 낫다.
  const centerDay = dayPillarOf(map.center);
  if (!centerDay || !dayPillarOf(input)) {
    return { status: 400, body: { error: "실제로 있는 날짜인지 확인해 주세요" } };
  }

  try {
    const row = await deps.add(map.id, input);
    const person = toMapPerson(centerDay, row);
    if (!person) return { status: 400, body: { error: "실제로 있는 날짜인지 확인해 주세요" } };
    return { status: 201, body: { person } };
  } catch (e) {
    if (e instanceof MapPeopleLimitError) return { status: 409, body: { error: e.message } };
    if (e instanceof DuplicatePersonError) return { status: 409, body: { error: e.message } };
    throw e;
  }
}

export interface DeleteDeps {
  findMap: () => Promise<MapRow | null>;
  /** 세션이 없으면 null */
  userId: string | null;
  personId: string;
  remove: (mapId: string, personId: string) => Promise<boolean>;
}

/**
 * 사람 삭제. 소유자만이다 — 누구나 추가할 수 있으니 지울 수 있는 사람이 있어야 한다.
 *
 * 비소유자에게 404 가 아니라 403 을 준다. profiles 의 getProfile 이 404 로 접는
 * 것은 id 를 증가시켜 남의 것을 훑는 것을 막기 위해서인데, 여기서는 요청자가
 * share_id 를 이미 알고 그 지도를 보고 있으므로 존재는 이미 알려진 사실이다.
 */
export async function handleDeletePerson(deps: DeleteDeps): Promise<HandlerResult> {
  const map = await deps.findMap();
  if (!map) return { status: 404, body: { error: "지도를 찾을 수 없습니다" } };
  if (deps.userId === null || deps.userId !== map.ownerUserId) {
    return { status: 403, body: { error: "지도 주인만 지울 수 있습니다" } };
  }

  const removed = await deps.remove(map.id, deps.personId);
  if (!removed) return { status: 404, body: { error: "이미 지워진 사람입니다" } };
  return { status: 200, body: { ok: true } };
}
