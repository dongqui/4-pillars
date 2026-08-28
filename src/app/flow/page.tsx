import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/users";
import { listProfiles, type ProfileRow } from "@/lib/profiles/store";
import { toBirthInput } from "@/lib/profiles/to-birth-input";
import { toPersonOption } from "@/lib/profiles/option";
import { analyze, flowYearAt, flowYearOf } from "@/lib/saju-core";
import { sajuBirthYearOf } from "@/lib/flows/birth-year";
import { listFlowYears } from "@/lib/flows/store";
import { listEntitledSubjects } from "@/lib/tickets/entitlements";
import { getBalance } from "@/lib/tickets/wallet";
import { FLOW_YEAR_SPAN } from "@/app/api/flows/_lib/handler";
import { AppHeader } from "@/components/AppHeader";
import { resolveDisplayName } from "@/lib/auth/display-name";
import { FlowConfirm } from "./_components/FlowConfirm";
import { buildYearOptions, formatRangeLabel } from "./_lib/to-confirm";

export default async function FlowPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/flow");

  const [user, rows, tickets] = await Promise.all([
    getUser(session.userId),
    listProfiles(session.userId),
    // 모달의 "보유 N장" 에 쓴다. 화면에 뜬 뒤 다른 탭에서 쓰거나 충전할 수 있어
    // 스냅숏일 뿐이다 — 결제 판정은 언제나 서버(POST /api/flows)가 한다.
    getBalance(session.userId),
  ]);
  const currentYear = flowYearAt(new Date()).year;

  // 권한은 한 번만 읽는다 — 프로필 × 연도 칸마다 물으면 왕복이 수십 번이다.
  const entitled = new Set(await listEntitledSubjects(session.userId, "yearly_flow"));

  // 같은 연도의 입춘 구간은 사람과 무관하다 — 한 번 계산해 전 프로필이 공유한다.
  const rangeOf = (y: number) => {
    const period = flowYearOf(y);
    return formatRangeLabel(period.start, period.end);
  };

  const perProfile = await Promise.all(
    rows.map(async (row) => {
      const flows = await listFlowYears(session.userId, row.id);
      const owned = new Map(
        flows.map((f) => [f.flowYear, { flowId: f.id, entitled: entitled.has(f.id) }]),
      );
      // handler.ts 와 같은 계산(sajuBirthYearOf) — 화면이 달력 연도로 칸을 거르면
      // 서버가 파는 해를 화면이 감춘다.
      const birthYear = sajuBirthYearOf(analyze(toBirthInput(row)));
      const years = buildYearOptions({ currentYear, span: FLOW_YEAR_SPAN, birthYear, rangeOf, owned });
      return { person: toPersonOption(row), years };
    }),
  );

  return (
    <div className="min-h-screen bg-white text-slate-900 leading-normal break-keep [overflow-wrap:break-word]">
      <AppHeader displayName={resolveDisplayName(user)} />
      <main>
        <FlowConfirm
          people={perProfile.map((p) => p.person)}
          yearsByProfile={perProfile.map((p) => p.years)}
          initialProfile={primaryIndex(rows, user?.primaryProfileId ?? null)}
          tickets={tickets}
        />
      </main>
    </div>
  );
}

/**
 * "나" 로 정한 프로필의 자리. src/app/home/_components/HomeIdentity.tsx 가
 * users.primary_profile_id 로 같은 값을 고르는 것과 같은 규칙이다.
 *
 * primaryId 가 없거나 가리키는 프로필이 목록에 없으면 첫 줄로 물러선다 —
 * HomeIdentity 의 index 계산과 같은 폴백이다.
 */
function primaryIndex(rows: ProfileRow[], primaryId: string | null): number {
  if (!primaryId) return 0;
  const i = rows.findIndex((r) => r.id === primaryId);
  return i >= 0 ? i : 0;
}
