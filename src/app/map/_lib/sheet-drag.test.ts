import { describe, it, expect } from "vitest";
import { sheetOffset, settleSheet, DRAG_DISTANCE, TAP_SLOP } from "./sheet-drag";

describe("sheetOffset", () => {
  it("아래로 끈 만큼 따라간다", () => {
    expect(sheetOffset(40, 300)).toBe(40);
  });

  it("접힌 자리보다 더 내려가지 않는다 — 손잡이는 늘 화면에 남는다", () => {
    expect(sheetOffset(500, 300)).toBe(300);
  });

  it("위로 끄는 것은 따라가지 않는다 — 시트가 헤더 위로 떠오를 자리는 없다", () => {
    expect(sheetOffset(-80, 300)).toBe(0);
  });

  it("접혀 있으면(max 0) 어느 쪽으로 끌어도 제자리다", () => {
    expect(sheetOffset(120, 0)).toBe(0);
    expect(sheetOffset(-120, 0)).toBe(0);
  });
});

describe("settleSheet", () => {
  const slow = 1000;

  it("탭이 조금 흔들린 정도로는 안 닫힌다", () => {
    expect(settleSheet({ open: true, dy: TAP_SLOP - 1, dt: 40 })).toBe("stay");
  });

  it("느리게 조금만 끌면 되돌아간다", () => {
    expect(settleSheet({ open: true, dy: DRAG_DISTANCE - 1, dt: slow })).toBe("stay");
  });

  it("충분히 끌어 내리면 닫힌다", () => {
    expect(settleSheet({ open: true, dy: DRAG_DISTANCE, dt: slow })).toBe("close");
  });

  it("짧아도 빠르게 튕기면 닫힌다 — 손가락이 화면 끝까지 갈 필요는 없다", () => {
    expect(settleSheet({ open: true, dy: 20, dt: 40 })).toBe("close");
  });

  it("열린 시트를 위로 끄는 것은 아무 일도 아니다", () => {
    expect(settleSheet({ open: true, dy: -200, dt: slow })).toBe("stay");
  });

  it("접힌 시트를 위로 끌어 올리면 펼쳐진다", () => {
    expect(settleSheet({ open: false, dy: -DRAG_DISTANCE, dt: slow })).toBe("open");
  });

  it("접힌 시트를 아래로 끄는 것은 아무 일도 아니다", () => {
    expect(settleSheet({ open: false, dy: 200, dt: slow })).toBe("stay");
  });

  it("dt 가 0 이어도 속도로 나누다 터지지 않는다", () => {
    expect(settleSheet({ open: true, dy: 2, dt: 0 })).toBe("stay");
    expect(settleSheet({ open: true, dy: 200, dt: 0 })).toBe("close");
  });
});
