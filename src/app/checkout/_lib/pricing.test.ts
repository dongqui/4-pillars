import { describe, it, expect } from "vitest";
import { formatKrw, formatPerTicket } from "./pricing";

describe("formatKrw", () => {
  it.each([
    [0, "₩0"],
    [900, "₩900"],
    [9900, "₩9,900"],
    [19900, "₩19,900"],
    [1234567, "₩1,234,567"],
  ])("%i → %s", (won, expected) => {
    expect(formatKrw(won)).toBe(expected);
  });
});

describe("formatPerTicket", () => {
  it("장당 단가를 반올림해 보여준다", () => {
    expect(formatPerTicket(10000, 13)).toBe("장당 ₩769");
    expect(formatPerTicket(1000, 1)).toBe("장당 ₩1,000");
  });
});
