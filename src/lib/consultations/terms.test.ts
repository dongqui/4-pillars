import { describe, it, expect } from "vitest";
import { countTerms } from "./terms";

describe("countTerms", () => {
  it("쓰인 용어 종류를 센다", () => {
    const r = countTerms(["비견·겁재가 무겁게 있어요", "상관이 얇은 편이에요"]);
    expect(r.count).toBe(3);
    expect(r.terms).toEqual(expect.arrayContaining(["비견", "겁재", "상관"]));
  });

  it("같은 용어를 여러 번 써도 한 종류다", () => {
    expect(countTerms(["비견이요", "비견이 또 나와요"]).count).toBe(1);
  });

  it("용어가 없으면 0 이다", () => {
    expect(countTerms(["오늘은 산책부터 해보세요"]).count).toBe(0);
  });

  // "금(상관·설기)" 처럼 괄호에 용어를 숨겨 넣는 자리를 잡는 게 목적이다.
  it("괄호에 숨긴 오행도 센다", () => {
    const r = countTerms(["밖으로 내보내는 쪽(금)이 약해요"]);
    expect(r.count).toBe(1);
  });

  // "금방", "토요일" 처럼 흔한 말까지 세면 숫자가 못 쓰게 된다.
  it("오행 한 글자가 일상어로 쓰인 것은 세지 않는다", () => {
    expect(countTerms(["금방 끝나요", "토요일에 해보세요"]).count).toBe(0);
  });

  // 실제로 "(새 세입자가 안 구해졌다, 수리비를 제하겠다는 등)" 이 한 종류로 잡혔다.
  it("괄호 안의 보통 문장을 용어로 세지 않는다", () => {
    expect(countTerms(["이유(수리비를 제하겠다는 등)를 남겨 두세요"]).count).toBe(0);
  });

  it("\"금 기운\" 처럼 쓴 오행은 센다", () => {
    expect(countTerms(["금 기운을 쓰는 편이에요"]).count).toBe(1);
  });
});
