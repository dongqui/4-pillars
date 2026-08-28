import { describe, expect, it } from "vitest";
import type { SqlClient } from "@/lib/db";
import { FLOW_SECTIONS } from "./sections";
import { decodeFlowSections, getFlowSections } from "./store";

const overview = {
  title: "제목",
  body: "본문",
  keywords: ["가", "나", "다", "라"],
};

describe("decodeFlowSections", () => {
  it("멀쩡한 행은 담는다", () => {
    const out = decodeFlowSections(
      [
        {
          section_key: "overview",
          content: overview,
          schema_version: FLOW_SECTIONS.overview.version,
        },
      ],
      ["overview"],
    );
    expect(out.have.overview).toEqual(overview);
    expect(out.missing).toEqual([]);
  });

  // Neon HTTP 드라이버는 jsonb 를 이미 파싱해서 줄 때도 있고 문자열 그대로 줄 때도
  // 있다 (src/lib/consultations/store.ts 의 toStringArray, src/lib/flows/store.ts 의
  // toMonths 가 이미 겪은 문제). 여기서는 문자열로 온 content 를 파싱한 뒤 검증에
  // 넘겨야 한다 — 그러지 않으면 멀쩡히 팔린 행이 파싱 경로 차이만으로 "없는 섹션"
  // 취급되어 이용권 원가를 또 태워 재생성된다.
  it("드라이버가 content 를 문자열로 주는 경우에도 파싱한 형태와 똑같이 담는다", () => {
    const parsed = decodeFlowSections(
      [
        {
          section_key: "overview",
          content: overview,
          schema_version: FLOW_SECTIONS.overview.version,
        },
      ],
      ["overview"],
    );
    const stringified = decodeFlowSections(
      [
        {
          section_key: "overview",
          content: JSON.stringify(overview),
          schema_version: FLOW_SECTIONS.overview.version,
        },
      ],
      ["overview"],
    );
    expect(stringified.have).toEqual(parsed.have);
    expect(stringified.missing).toEqual([]);
  });

  it("버전이 다른 행은 버린다 — 옛 스키마의 서술을 그대로 쓰면 안 된다", () => {
    const out = decodeFlowSections(
      [{ section_key: "overview", content: overview, schema_version: 0 }],
      ["overview"],
    );
    expect(out.missing).toEqual(["overview"]);
  });

  it("모르는 키는 무시한다 — 지워진 섹션이다", () => {
    // 구 pivots(옛 08) 행이 정확히 이 경로로 무시된다 — 섹션 삭제에 데이터
    // 마이그레이션이 필수가 아닌 이유다.
    const out = decodeFlowSections(
      [
        { section_key: "사라진섹션", content: {}, schema_version: 1 },
        { section_key: "pivots", content: { lead: "l", pivots: [] }, schema_version: 2 },
      ],
      ["overview"],
    );
    expect(out.have).toEqual({});
  });

  // 파싱조차 안 되는 깨진 JSON 문자열은 "없는 섹션" 으로 떨어져야 한다 — 절반만
  // 파싱해 채우거나 예외를 던져 요청 전체를 끊으면 안 된다.
  it("파싱 자체가 실패하는 문자열도 던지지 않고 missing 으로 떨어뜨린다", () => {
    const out = decodeFlowSections(
      [
        {
          section_key: "overview",
          content: "{이건 JSON 이 아니다",
          schema_version: FLOW_SECTIONS.overview.version,
        },
      ],
      ["overview"],
    );
    expect(out.missing).toEqual(["overview"]);
    expect(out.have).toEqual({});
  });

  it("버전은 맞는데 스키마에 걸리는 행도 missing 으로 떨어뜨린다", () => {
    // jsonb 손상 등 정상적으로는 나올 수 없는 상태다. 조용히 통과시키면 화면이
    // 깨진 서술을 그리고, missing 으로 떨어뜨리면 다음 열람에서 다시 만들어진다
    // — 지갑은 entitlements 행이 남아 안전하다.
    const out = decodeFlowSections(
      [
        {
          section_key: "overview",
          content: { title: "제목만 있고 나머지가 없다" },
          schema_version: FLOW_SECTIONS.overview.version,
        },
      ],
      ["overview"],
    );
    expect(out.missing).toEqual(["overview"]);
  });
});

describe("getFlowSections", () => {
  it("빈 키 목록이면 DB 를 부르지 않는다", async () => {
    let called = false;
    const client = (() => {
      called = true;
      return Promise.resolve([]);
    }) as unknown as SqlClient;

    expect(await getFlowSections("7", [], client)).toEqual({
      have: {},
      missing: [],
    });
    expect(called).toBe(false);
  });
});
