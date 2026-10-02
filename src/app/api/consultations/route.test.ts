import { describe, it, expect, vi, beforeEach } from "vitest";

const getSession = vi.fn();
const getProfile = vi.fn();
const defaultConsultationSubject = vi.fn();
const listConsultations = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getSession: (...a: unknown[]) => getSession(...a),
}));
vi.mock("@/lib/profiles/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profiles/store")>()),
  getProfile: (...a: unknown[]) => getProfile(...a),
}));
vi.mock("@/lib/consultations/subject", () => ({
  defaultConsultationSubject: (...a: unknown[]) => defaultConsultationSubject(...a),
}));
vi.mock("@/lib/consultations/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/consultations/store")>()),
  listConsultations: (...a: unknown[]) => listConsultations(...a),
}));

import { GET } from "./route";

const get = (query = "") => GET(new Request(`http://localhost/api/consultations${query}`));

describe("GET /api/consultations", () => {
  beforeEach(() => {
    getSession.mockReset().mockResolvedValue({ userId: "3" });
    getProfile.mockReset();
    defaultConsultationSubject.mockReset();
    listConsultations.mockReset().mockResolvedValue([]);
  });

  // 목록이 프로필로 걸러져야 홈에서 사람을 바꿨을 때 상담 목록도 바뀐다. POST 가
  // ?profile 로 상담을 여는 것과 같은 프로필을 GET 도 본다.
  it("?profile 의 저장 프로필로 목록을 거른다", async () => {
    getProfile.mockResolvedValue({ id: "12", kind: "saved" });

    await get("?profile=12");
    expect(listConsultations).toHaveBeenCalledWith("3", "12");
  });

  // temp 프로필로는 상담을 못 연다(POST 와 같은 규칙) — 그러니 목록도 그 사람으로
  // 보여 줄 것이 없다. 계정의 "나" 로 물러선다.
  it("저장 프로필이 아니면 계정의 나로 물러선다", async () => {
    getProfile.mockResolvedValue({ id: "6", kind: "temp" });
    defaultConsultationSubject.mockResolvedValue({ id: "2" });

    await get("?profile=6");
    expect(listConsultations).toHaveBeenCalledWith("3", "2");
  });

  it("?profile 이 없으면 계정의 나", async () => {
    defaultConsultationSubject.mockResolvedValue({ id: "2" });

    await get();
    expect(getProfile).not.toHaveBeenCalled();
    expect(listConsultations).toHaveBeenCalledWith("3", "2");
  });

  // 프로필이 하나도 없는 계정은 상담을 가질 수 없다 — 빈 목록이지 500 이 아니다.
  it("프로필이 하나도 없으면 빈 목록", async () => {
    defaultConsultationSubject.mockResolvedValue(undefined);

    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ consultations: [] });
    expect(listConsultations).not.toHaveBeenCalled();
  });

  it("세션이 없으면 401", async () => {
    getSession.mockResolvedValue(null);

    const res = await get();
    expect(res.status).toBe(401);
  });
});
