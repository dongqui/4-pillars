import { describe, it, expect } from "vitest";
import {
  TICKET_PACKAGE_IDS,
  creditedTickets,
  getPackage,
  listPackages,
  packageOrderName,
} from "./pricing";

describe("TICKET_PACKAGES", () => {
  it("listPackages 는 TICKET_PACKAGE_IDS 순서를 그대로 낸다 — 화면 순서가 여기서 정해진다", () => {
    expect(listPackages().map((p) => p.id)).toEqual([...TICKET_PACKAGE_IDS]);
  });

  it("모든 패키지의 청구 금액과 기본 장수가 양수다", () => {
    for (const p of listPackages()) {
      expect(p.amount).toBeGreaterThan(0);
      expect(p.tickets).toBeGreaterThan(0);
      expect(p.bonus).toBeGreaterThanOrEqual(0);
    }
  });

  it("장수가 많은 패키지일수록 장당 단가가 싸다 — 묶음 유인이 사라지면 표가 잘못된 것이다", () => {
    const perTicket = listPackages().map((p) => p.amount / creditedTickets(p));
    for (let i = 1; i < perTicket.length; i++) {
      expect(perTicket[i]).toBeLessThan(perTicket[i - 1]);
    }
  });
});

describe("creditedTickets", () => {
  it("기본 + 보너스", () => {
    expect(creditedTickets(getPackage("t5"))).toBe(6);
    expect(creditedTickets(getPackage("t10"))).toBe(13);
    expect(creditedTickets(getPackage("t1"))).toBe(1);
  });
});

describe("packageOrderName", () => {
  it("적립 장수를 쓴다 — 카드 명세서에 실제로 받는 장수가 찍혀야 한다", () => {
    expect(packageOrderName(getPackage("t5"))).toBe("이용권 6장");
  });

  it("프로필 이름을 넣지 않는다 — 명세서에 타인의 이름이 남을 이유가 없다", () => {
    for (const p of listPackages()) {
      expect(packageOrderName(p)).toMatch(/^이용권 \d+장$/);
    }
  });
});
