import { describe, expect, it } from "vitest";
import type { SqlClient } from "@/lib/db";
import { FLOW_SECTIONS } from "./sections";
import { decodeFlowSections, getFlowSections } from "./store";

// pivots 를 쓰지 않는 섹션(overview)의 검증은 ctx 값에 좌우되지 않으므로 빈
// pivotMonths 로 고정해 둔다. 변곡점 자체를 검증하는 손상 판정은 아래 별도
// describe 에서 다룬다.
const NO_PIVOTS_CTX = { pivotMonths: [] as number[] };

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
      NO_PIVOTS_CTX,
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
      NO_PIVOTS_CTX,
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
      NO_PIVOTS_CTX,
    );
    expect(stringified.have).toEqual(parsed.have);
    expect(stringified.missing).toEqual([]);
  });

  it("버전이 다른 행은 버린다 — 옛 스키마의 서술을 그대로 쓰면 안 된다", () => {
    const out = decodeFlowSections(
      [{ section_key: "overview", content: overview, schema_version: 0 }],
      ["overview"],
      NO_PIVOTS_CTX,
    );
    expect(out.missing).toEqual(["overview"]);
  });

  it("모르는 키는 무시한다 — 지워진 섹션이다", () => {
    const out = decodeFlowSections(
      [{ section_key: "사라진섹션", content: {}, schema_version: 1 }],
      ["overview"],
      NO_PIVOTS_CTX,
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
      NO_PIVOTS_CTX,
    );
    expect(out.missing).toEqual(["overview"]);
    expect(out.have).toEqual({});
  });
});

describe("decodeFlowSections — 손상 판정", () => {
  const CTX = { pivotMonths: [3, 7] };

  // 하드코딩된 숫자를 쓰면 FLOW_SECTIONS.pivots.version 이 오를 때마다 이 테스트가
  // "버전 불일치로 missing" 경로를 (의도치 않게) 함께 테스트하게 된다 — 이 describe
  // 가 실제로 보려는 건 손상 판정이지 버전 비교가 아니다.
  const row = (content: unknown) => ({
    section_key: "pivots",
    schema_version: FLOW_SECTIONS.pivots.version,
    content: JSON.stringify(content),
  });

  it("저장된 변곡점이 계산과 어긋나면 없는 섹션으로 본다", () => {
    // months 는 박제라 정상적으로는 달라질 수 없다 — 어긋나면 손상이다.
    // 조용히 통과시키면 08 이 07 과 다른 달을 가리킨다.
    const bad = row({
      lead: "l",
      pivots: [{ monthIndex: 5, title: "t", body: "b" }],
    });
    const out = decodeFlowSections([bad], ["pivots"], CTX);
    expect(out.missing).toContain("pivots");
  });

  it("일치하면 그대로 쓴다 — 헛되이 재생성하지 않는다", () => {
    const good = row({
      lead: "l",
      pivots: [
        { monthIndex: 3, title: "t", body: "b" },
        { monthIndex: 7, title: "t", body: "b" },
      ],
    });
    const out = decodeFlowSections([good], ["pivots"], CTX);
    expect(out.missing).not.toContain("pivots");
  });
});

describe("getFlowSections", () => {
  it("빈 키 목록이면 DB 를 부르지 않는다", async () => {
    let called = false;
    const client = (() => {
      called = true;
      return Promise.resolve([]);
    }) as unknown as SqlClient;

    expect(await getFlowSections("7", [], NO_PIVOTS_CTX, client)).toEqual({
      have: {},
      missing: [],
    });
    expect(called).toBe(false);
  });
});
