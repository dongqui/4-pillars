import { ProfileLimitError, type CreateProfileInput } from "@/lib/profiles/store";
import { createProfileSchema } from "@/lib/profiles/input";

export interface HandlerDeps {
  /** 세션이 없으면 null */
  userId: string | null;
  create: (userId: string, input: CreateProfileInput) => Promise<{ id: string }>;
}

export interface HandlerResult {
  status: number;
  body: { id: string } | { error: string };
}

export async function handleCreateProfile(
  raw: unknown,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  if (!deps.userId) return { status: 401, body: { error: "로그인이 필요합니다" } };

  const parsed = createProfileSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "입력을 확인해 주세요" } };

  const d = parsed.data;
  const input: CreateProfileInput = {
    ...d,
    // 서로 어긋난 조합은 여기서 정리한다 — 어긋난 행이 DB 에 남으면
    // 나중에 어느 쪽이 진실인지 알 수 없다.
    time: d.timeKnown ? d.time : null,
    isLeapMonth: d.calendar === "lunar" ? d.isLeapMonth : false,
  };

  try {
    const { id } = await deps.create(deps.userId, input);
    return { status: 201, body: { id } };
  } catch (e) {
    // 한도 초과는 클라이언트가 분기해야 하는 정상 응답이다. 나머지는 500 으로 흘린다.
    if (e instanceof ProfileLimitError) return { status: 409, body: { error: "limit" } };
    throw e;
  }
}
