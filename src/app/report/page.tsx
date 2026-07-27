import { getReportAccess } from "./_lib/access";
import { sampleReport } from "./_lib/report-content.fixture";
import { ReportView } from "./_components/ReportView";
import { getSession } from "@/lib/auth/session";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const access = getReportAccess(sp, session);
  return <ReportView content={sampleReport} access={access} />;
}
