import { describe, it, expect } from "vitest";
import { parseProfileParam } from "./param";

describe("parseProfileParam", () => {
  it("파라미터가 없으면 absent — 호출자가 알아서 다룬다", () => {
    expect(parseProfileParam({})).toEqual({ kind: "absent" });
  });

  it("순번 id 는 문자열 그대로 통과", () => {
    expect(parseProfileParam({ profile: "12" })).toEqual({ kind: "id", id: "12" });
  });

  it("배열 쿼리값도 첫 값으로 처리", () => {
    expect(parseProfileParam({ profile: ["7", "8"] })).toEqual({ kind: "id", id: "7" });
  });

  // ::bigint 캐스팅 전에 막지 않으면 잘못된 값 하나가 DB 에러 → 500 이 된다.
  it.each(["abc", "1 OR 1=1", "", "-1", "1.5", "1e3", " 12", "9".repeat(20), "007"])(
    "%o 는 invalid — DB 를 건드리지 않는다",
    (raw) => {
      expect(parseProfileParam({ profile: raw })).toEqual({ kind: "invalid" });
    },
  );

  it("bigint 상한(9223372036854775807)은 통과한다", () => {
    expect(parseProfileParam({ profile: "9223372036854775807" })).toEqual({
      kind: "id",
      id: "9223372036854775807",
    });
  });

  it("bigint 상한을 하나 넘으면(9223372036854775808) invalid — ::bigint 캐스팅이 넘치지 않게", () => {
    expect(parseProfileParam({ profile: "9223372036854775808" })).toEqual({ kind: "invalid" });
  });
});
