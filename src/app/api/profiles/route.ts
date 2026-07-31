import { getSession } from "@/lib/auth/session";
import { createProfile } from "@/lib/profiles/store";
import { handleCreateProfile } from "./_lib/handler";

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleCreateProfile(raw, {
      userId: session?.userId ?? null,
      create: createProfile,
    });
    return Response.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/profiles]", e);
    return Response.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
