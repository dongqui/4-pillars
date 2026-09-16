import { expect, it } from "vitest";
import { resolveFlowRoute } from "./resolve-flow-route";

const r = (phase: string) => ({ phase }) as never;
const base = { active: null, hasV1Sections: false, pending: null, latest: null };

it("active → published (v1 섹션이 있어도)", () =>
  expect(resolveFlowRoute({ ...base, active: r("complete"), hasV1Sections: true })).toBe("v2:published"));

it("v1 섹션 → v1 (pending 이 남아 있어도 legacy 먼저)", () =>
  expect(resolveFlowRoute({ ...base, hasV1Sections: true, pending: r("draft") })).toBe("v1"));

it("pending → generate", () =>
  expect(resolveFlowRoute({ ...base, pending: r("draft"), latest: r("draft") })).toBe("v2:generate"));

it("latest failed → failed", () =>
  expect(resolveFlowRoute({ ...base, latest: r("failed") })).toBe("v2:failed"));

it("아무것도 없으면 v1 — 첫 열람이 v1 섹션을 만든다", () =>
  expect(resolveFlowRoute(base)).toBe("v1"));
