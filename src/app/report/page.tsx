import { getReportAccess } from "./_lib/access";
import { sampleReport } from "./_lib/report-content.fixture";
import { ReportShell } from "./_components/ReportShell";
import { ReportBody } from "./_components/ReportBody";
import { getSession } from "@/lib/auth/session";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const access = getReportAccess(sp, session);
  // 세션이 있을 때만 "내 프로필" 링크를 보여준다 — 비로그인 방문자는 목록 자체가 없다.
  return (
    <ReportShell showHomeLink={session !== null}>
      <ReportBody content={sampleReport} access={access} />
    </ReportShell>
  );
}
