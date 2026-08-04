import { describe, it, expect } from "vitest";
import {
  deleteDraft,
  generateDraftToken,
  getDraft,
  putDraft,
  type DraftClient,
} from "./store";

const validBody = {
  name: "김동진",
  gender: "male" as const,
  calendar: "solar" as const,
  isLeapMonth: false,
  birth: { year: 1990, month: 10, day: 25 },
  timeKnown: true,
  time: { hour: 15, minute: 20 },
  birthPlace: { country: "KR" as const, regionId: "seoul" },
  trueSolar: true,
};

/** 호출된 연산과 키를 기록하는 가짜 Redis. 값은 메모리에 담는다. */
function fakeClient() {
  const store = new Map<string, unknown>();
  const calls: { op: string; key: string; opts?: unknown }[] = [];
  const client: DraftClient = {
    async set(key, value, opts) {
      calls.push({ op: "set", key, opts });
      store.set(key, value);
      return "OK";
    },
    async get(key) {
      calls.push({ op: "get", key });
      return store.has(key) ? store.get(key) : null;
    },
    async del(key) {
      calls.push({ op: "del", key });
      store.delete(key);
      return 1;
    },
  };
  return { client, calls, store };
}

describe("드래프트 저장소", () => {
  it("draft:<token> 키에 7일 TTL 로 쓴다", async () => {
    const { client, calls } = fakeClient();
    await putDraft("tok", validBody, client);
    expect(calls[0]).toEqual({ op: "set", key: "draft:tok", opts: { ex: 60 * 60 * 24 * 7 } });
  });

  it("넣은 값을 그대로 돌려준다", async () => {
    const { client } = fakeClient();
    await putDraft("tok", validBody, client);
    expect(await getDraft("tok", client)).toEqual(validBody);
  });

  it("없는 토큰은 null", async () => {
    const { client } = fakeClient();
    expect(await getDraft("없는토큰", client)).toBeNull();
  });

  // 배포 사이에 스키마가 바뀌면 옛 레코드가 남아 있을 수 있다. 검증 없이 통과시키면
  // 그 값이 그대로 DB 까지 간다.
  it("현재 스키마에 안 맞는 레코드는 null", async () => {
    const { client, store } = fakeClient();
    store.set("draft:tok", { name: "김동진" });
    expect(await getDraft("tok", client)).toBeNull();
  });

  it("deleteDraft 는 키를 지운다", async () => {
    const { client, store } = fakeClient();
    await putDraft("tok", validBody, client);
    await deleteDraft("tok", client);
    expect(store.has("draft:tok")).toBe(false);
  });

  it("토큰은 호출마다 다르다", () => {
    expect(generateDraftToken()).not.toBe(generateDraftToken());
  });
});
