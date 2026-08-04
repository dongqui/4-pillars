import { ProfileLimitError, type CreateProfileInput } from "@/lib/profiles/store";
import { createProfileSchema, type CreateProfileBody } from "@/lib/profiles/input";

export interface HandlerDeps {
  /** 세션이 없으면 null */
  userId: string | null;
  create: (userId: string, input: CreateProfileInput) => Promise<{ id: string }>;
  /** 로그인 전 입력을 임시로 맡아둔다 */
  saveDraft: (token: string, body: CreateProfileBody) => Promise<void>;
  newToken: () => string;
  /** 요청에 실려온 draft 쿠키. 있으면 그 자리에 덮어쓴다 */
  existingToken: string | null;
}

export interface HandlerResult {
  status: number;
  body: { id: string } | Record<string, never> | { error: string };
  /** 있으면 라우트가 쿠키를 굽는다 */
  draftToken?: string;
}

export async function handleCreateProfile(
  raw: unknown,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  const parsed = createProfileSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "입력을 확인해 주세요" } };

  const d = parsed.data;
  // 서로 어긋난 조합은 여기서 정리한다 — 어긋난 값이 DB 든 Redis 든 남으면
  // 나중에 어느 쪽이 진실인지 알 수 없다. 두 갈래가 같은 값을 받게 검증 뒤에 둔다.
  const body: CreateProfileBody = {
    ...d,
    time: d.timeKnown ? d.time : null,
    isLeapMonth: d.calendar === "lunar" ? d.isLeapMonth : false,
  };

  // 주인이 아직 없다. 값은 Redis 가 갖고 손잡이만 쿠키로 돌려준다.
  // 202 는 에러가 아니라 "받았고, 주인이 정해지면 확정한다"는 뜻이다.
  if (!deps.userId) {
    const token = deps.existingToken ?? deps.newToken();
    await deps.saveDraft(token, body);
    return { status: 202, body: {}, draftToken: token };
  }

  try {
    const { id } = await deps.create(deps.userId, body);
    return { status: 201, body: { id } };
  } catch (e) {
    // 한도 초과는 클라이언트가 분기해야 하는 정상 응답이다. 나머지는 500 으로 흘린다.
    if (e instanceof ProfileLimitError) return { status: 409, body: { error: "limit" } };
    throw e;
  }
}
