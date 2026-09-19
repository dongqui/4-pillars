import { describe, it, expect, afterEach, vi } from "vitest";
import {
  REVIEW_SAMPLE_PROFILE,
  reviewLoginConfig,
  seedSampleProfile,
  verifyReviewLogin,
  type SeedSampleDeps,
} from "./review-login";

const CONFIG = { id: "pgreview", password: "dummy-Pass#1", email: "guest@example.com" };

describe("reviewLoginConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("셋이 다 있으면 설정을 돌려준다", () => {
    vi.stubEnv("REVIEW_LOGIN_ID", "pgreview");
    vi.stubEnv("REVIEW_LOGIN_PASSWORD", "dummy-Pass#1");
    vi.stubEnv("REVIEW_LOGIN_EMAIL", "guest@example.com");
    expect(reviewLoginConfig()).toEqual(CONFIG);
  });

  // 심사가 끝나면 env 를 지워 닫는다 — 하나만 지워도 닫혀야 실수로 반쯤 열린 상태가 없다.
  it.each(["REVIEW_LOGIN_ID", "REVIEW_LOGIN_PASSWORD", "REVIEW_LOGIN_EMAIL"])(
    "%s 가 비면 null — 기능이 꺼진다",
    (missing) => {
      vi.stubEnv("REVIEW_LOGIN_ID", "pgreview");
      vi.stubEnv("REVIEW_LOGIN_PASSWORD", "dummy-Pass#1");
      vi.stubEnv("REVIEW_LOGIN_EMAIL", "guest@example.com");
      vi.stubEnv(missing, "");
      expect(reviewLoginConfig()).toBeNull();
    },
  );

  it("아이디·이메일의 앞뒤 공백은 걷어낸다 — 호스팅 콘솔에 붙여 넣다 딸려 온 공백", () => {
    vi.stubEnv("REVIEW_LOGIN_ID", " pgreview ");
    vi.stubEnv("REVIEW_LOGIN_PASSWORD", "dummy-Pass#1");
    vi.stubEnv("REVIEW_LOGIN_EMAIL", " guest@example.com ");
    expect(reviewLoginConfig()).toEqual(CONFIG);
  });
});

describe("verifyReviewLogin", () => {
  it("아이디·비밀번호가 둘 다 맞으면 true", () => {
    expect(verifyReviewLogin(CONFIG, "pgreview", "dummy-Pass#1")).toBe(true);
  });

  it("담당자가 아이디 뒤에 공백을 붙여 넣어도 통과한다", () => {
    expect(verifyReviewLogin(CONFIG, "pgreview ", "dummy-Pass#1")).toBe(true);
  });

  it("비밀번호는 공백까지 그대로 비교한다", () => {
    expect(verifyReviewLogin(CONFIG, "pgreview", "dummy-Pass#1 ")).toBe(false);
  });

  it("비밀번호가 틀리면 false", () => {
    expect(verifyReviewLogin(CONFIG, "pgreview", "dummy-Pass#2")).toBe(false);
  });

  it("아이디가 틀리면 false", () => {
    expect(verifyReviewLogin(CONFIG, "admin", "dummy-Pass#1")).toBe(false);
  });

  it("길이가 다른 입력에도 throw 하지 않는다 — timingSafeEqual 은 길이가 다르면 던진다", () => {
    expect(verifyReviewLogin(CONFIG, "p", "")).toBe(false);
  });

  // 카드사에는 이메일을 계정으로 알려 준다. 아이디와 이메일 어느 쪽으로 들어와도 같은 계정이다.
  it("아이디 자리에 이메일을 넣어도 통과한다", () => {
    expect(verifyReviewLogin(CONFIG, "guest@example.com", "dummy-Pass#1")).toBe(true);
  });

  it("이메일은 대소문자를 가리지 않는다 — 모바일 키보드가 첫 글자를 올린다", () => {
    expect(verifyReviewLogin(CONFIG, " Guest@Example.COM ", "dummy-Pass#1")).toBe(true);
  });

  it("아이디는 대소문자를 가린다 — 느슨하게 받는 것은 이메일뿐이다", () => {
    expect(verifyReviewLogin(CONFIG, "PGREVIEW", "dummy-Pass#1")).toBe(false);
  });

  it("이메일이 맞아도 비밀번호가 틀리면 false", () => {
    expect(verifyReviewLogin(CONFIG, "guest@example.com", "dummy-Pass#2")).toBe(false);
  });

  it("남의 이메일은 false", () => {
    expect(verifyReviewLogin(CONFIG, "someone@example.com", "dummy-Pass#1")).toBe(false);
  });
});

describe("seedSampleProfile", () => {
  function deps(over: Partial<SeedSampleDeps> = {}): SeedSampleDeps {
    return {
      countProfiles: vi.fn().mockResolvedValue(0),
      createProfile: vi.fn().mockResolvedValue({ id: "77" }),
      setPrimaryIfUnset: vi.fn().mockResolvedValue(undefined),
      ...over,
    };
  }

  it("저장된 프로필이 없으면 샘플을 만들고 '나' 로 정한다", async () => {
    const d = deps();
    await seedSampleProfile("9", d);

    expect(d.countProfiles).toHaveBeenCalledWith("9", "saved");
    expect(d.createProfile).toHaveBeenCalledWith("9", REVIEW_SAMPLE_PROFILE);
    expect(d.setPrimaryIfUnset).toHaveBeenCalledWith("9", "77");
  });

  // 'temp' 는 어느 목록에도 서지 않는다 — 담당자 눈에 안 보이는 샘플은 없는 것과 같다.
  it("샘플은 홈에 뜨는 'saved' 프로필이다", () => {
    expect(REVIEW_SAMPLE_PROFILE.kind).toBe("saved");
  });

  it("프로필이 이미 있으면 아무것도 만들지 않는다 — 로그인할 때마다 쌓이면 안 된다", async () => {
    const d = deps({ countProfiles: vi.fn().mockResolvedValue(1) });
    await seedSampleProfile("9", d);

    expect(d.createProfile).not.toHaveBeenCalled();
    expect(d.setPrimaryIfUnset).not.toHaveBeenCalled();
  });

  // 호출 시점에 세션 쿠키는 아직 응답에 실리지 않았다 — 여기서 새면 샘플 실패가 로그인 실패로 번진다.
  it("만들다 실패해도 throw 하지 않는다", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps({ createProfile: vi.fn().mockRejectedValue(new Error("db down")) });

    await expect(seedSampleProfile("9", d)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
