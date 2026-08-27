import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/users";
import { listProfiles, type ProfileRow } from "@/lib/profiles/store";
import { flowYearAt } from "@/lib/saju-core";
import { findFlow } from "@/lib/flows/store";
import { hasEntitlement } from "@/lib/tickets/entitlements";
import { FlowConfirm } from "./_components/FlowConfirm";
import { toConfirmState } from "./_lib/to-confirm";

export default async function FlowPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/flow");

  // 홈에서 "나로 정한" 프로필을 기본 선택으로 쓴다.
  const profile = await loadPrimaryProfile(session.userId);

  const period = flowYearAt(new Date());
  const existing = profile ? await findFlow(profile.id, period.year) : null;
  const owned = existing
    ? await hasEntitlement(session.userId, "yearly_flow", existing.id)
    : false;

  return (
    <FlowConfirm
      state={toConfirmState({
        profile: profile && { id: profile.id, name: profile.name },
        period: { start: period.start, end: period.end },
        existing: existing && { id: existing.id },
        owned,
      })}
    />
  );
}

/**
 * "나" 로 정한 프로필. src/app/home/page.tsx 가 users.primary_profile_id 로
 * 같은 값을 고르는 것과 같은 규칙이다 — 새 store 함수를 만들지 않고 listProfiles
 * 와 getUser 를 그대로 재사용한다.
 *
 * primaryProfileId 가 없거나(아직 아무것도 고른 적 없음) 가리키는 프로필이 목록에
 * 없으면(지워졌거나 temp 가 됨) 첫 줄로 물러선다 — HomeIdentity 의 index 계산과
 * 같은 폴백이다. listProfiles 가 이미 최신순이라 첫 줄이 가장 최근에 저장한 사람이다.
 */
async function loadPrimaryProfile(userId: string): Promise<ProfileRow | null> {
  const [user, rows] = await Promise.all([getUser(userId), listProfiles(userId)]);
  if (rows.length === 0) return null;

  const primaryId = user?.primaryProfileId ?? null;
  const matched = primaryId ? rows.find((r) => r.id === primaryId) : undefined;
  return matched ?? rows[0];
}
