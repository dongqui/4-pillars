import { getReportAccess } from "./_lib/access";
import { sampleReport } from "./_lib/report-content.fixture";
import { ReportView } from "./_components/ReportView";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const access = getReportAccess(sp);
  return <ReportView content={sampleReport} access={access} />;
}
