import { describe, it, expect } from "vitest";
import { toChatView } from "./to-chat-view";
import type { MessageRow } from "@/lib/consultations/store";

function msg(over: Partial<MessageRow>): MessageRow {
  return {
    id: "1",
    role: "user",
    bubbles: ["안녕하세요"],
    suggestions: null,
    crisis: false,
    asksUser: null,
    turnNo: 1,
    createdAt: "2026-08-17T00:00:00.000Z",
    ...over,
  };
}

describe("toChatView", () => {
  it("저장된 순서 그대로 말풍선을 편다", () => {
    const view = toChatView([
      msg({ role: "user", bubbles: ["고민이 있어요"] }),
      msg({ id: "2", role: "counselor", bubbles: ["첫 마디", "둘째 마디"] }),
    ]);
    expect(view).toHaveLength(2);
    expect(view[0]).toEqual({ key: "1", role: "user", bubbles: ["고민이 있어요"], isNew: false });
    expect(view[1].bubbles).toEqual(["첫 마디", "둘째 마디"]);
  });

  it("복원된 이력은 항상 isNew: false 다 — 방금 온 답만 애니메이션 대상이다", () => {
    const view = toChatView([
      msg({ id: "1", role: "user", bubbles: ["안녕하세요"] }),
      msg({ id: "2", role: "counselor", bubbles: ["반가워요"], suggestions: ["질문"] }),
    ]);
    expect(view.every((t) => t.isNew === false)).toBe(true);
  });

  // 추천 답변 칩은 없앴다(2026-09-16). 옛 행에 저장된 suggestions 가 화면으로 새면 안 된다.
  it("옛 행에 남은 추천질문을 화면으로 올리지 않는다", () => {
    const view = toChatView([
      msg({ id: "1", role: "counselor", bubbles: ["최근 답"], suggestions: ["새 질문"] }),
    ]);
    expect(view[0]).toEqual({ key: "1", role: "counselor", bubbles: ["최근 답"], isNew: false });
  });

  it("빈 이력은 빈 배열이다", () => {
    expect(toChatView([])).toEqual([]);
  });
});
