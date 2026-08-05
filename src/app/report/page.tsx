import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { analyze } from "@/lib/saju-core";
import { getSession } from "@/lib/auth/session";
import { getProfile, type ProfileRow } from "@/lib/profiles/store";
import { createGenerator } from "@/app/api/saju/_lib/generator";
import { GenerationError, produceSections } from "@/app/api/saju/_lib/produce";
import { getCached, putCached } from "@/app/api/saju/_lib/store";
import { getLuckCached, putLuckSections } from "@/app/api/saju/_lib/store-luck";
import { FREE_SECTION_KEYS, SECTION_KEYS, type Interpretation } from "@/app/api/saju/_lib/sections";
import type { InterpretationGenerator } from "@/app/api/saju/_lib/types";
import { getReportAccess, parseProfileParam, type ReportAccess } from "./_lib/access";
import { toBirthInput } from "./_lib/to-birth-input";
import { toReportMeta } from "./_lib/to-meta";
import { toReportContent } from "./_lib/to-report-content";
import { sampleReport } from "./_lib/report-content.fixture";
import { ReportShell } from "./_components/ReportShell";
import { ReportBody } from "./_components/ReportBody";
import { AnalyzingReport } from "./_components/AnalyzingReport";
import { ReportError } from "./_components/ReportError";

/**
 * 캐시 미스면 섹션마다 LLM 을 병렬로 부른다 — /api/saju/route.ts 와 같은 값.
 * 유료 12섹션(무료 4 + 유료 8, ?paid=true)은 daeunOutlook 이 느려 이 값을 넘길 수 있다.
 * 결제를 붙일 때 다시 본다.
 */
export const maxDuration = 60;

// 첫 요청에서 만든다. 모듈 로드 시점에 만들면 키가 없는 빌드 환경에서 빌드가 깨진다.
let generatorCache: InterpretationGenerator | undefined;
const generator = (): InterpretationGenerator => (generatorCache ??= createGenerator());

/** 계산·생성·조립. 여기만 느리므로 이 컴포넌트만 <Suspense> 안에 둔다. */
async function ProfileReport({
  profile,
  access,
}: {
  profile: ProfileRow;
  access: ReportAccess;
}) {
  // ?paid=true를 다시 붙이지 않는다 — 유료 판정은 이제 profile.isPaid(purchases 조인)가
  // 서버에서 내리므로 URL에 실을 이유가 없고, 프로덕션에서는 이 토글이 무시되니
  // 붙여봤자 유료 프로필의 재시도가 무료 리포트로 떨어지는 결과만 낳는다.
  const retryHref = `/report?profile=${profile.id}`;

  let analysis;
  try {
    analysis = analyze(toBirthInput(profile));
  } catch (e) {
    console.error("[/report] 원국 계산 실패", e);
    return <ReportError retryHref={retryHref} />;
  }

  const year = new Date().getFullYear();
  let interpretation: Partial<Interpretation>;
  try {
    ({ interpretation } = await produceSections(analysis, {
      generator: generator(),
      getCached,
      putCached,
      getLuckCached,
      putLuckSections,
      sectionKeys: access.isPaid ? SECTION_KEYS : FREE_SECTION_KEYS,
      year,
    }));
  } catch (e) {
    if (e instanceof GenerationError) {
      // 생성 실패면 캐시에 있던 것만으로 계속한다.
      console.error("[/report] 해석 생성 실패", e);
      interpretation = e.partial;
    } else {
      // DB 오류·DEEP_SEEK_API_KEY 누락(generator()) 등 그 외 예외는 여기서 삼킨다.
      // ReportShell 이 이미 스트리밍돼 나간 뒤라 Next 가 대신 에러를 렌더할 방법이
      // 없다(앱 전역 error.tsx 도 없다) — 던지면 사용자는 멈춘 스피너만 본다.
      console.error("[/report] 해석 확보 실패", e);
      return <ReportError retryHref={retryHref} />;
    }
  }

  // overview 가 없으면 히어로가 통째로 비어 리포트라 부를 것이 없다.
  // 그 외에는 확보한 섹션만 보여준다 — 빠진 섹션은 다음 방문에 missing 으로 다시 잡힌다.
  if (!interpretation.overview) return <ReportError retryHref={retryHref} />;

  const content = toReportContent(
    analysis,
    interpretation,
    toReportMeta(profile, analysis.chart),
    year,
  );
  return <ReportBody content={content} access={access} />;
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const access = getReportAccess(sp, session);
  const param = parseProfileParam(sp);

  // ?profile=abc 처럼 형태가 틀린 값을 데모로 떨어뜨리면 사용자는 남의 리포트를
  // 보고 있다고 오해한다.
  if (param.kind === "invalid") notFound();

  // 프로필이 없으면 지금까지처럼 픽스처 데모. 익명 실데이터는 이번 범위 밖이다.
  if (param.kind === "absent") {
    return (
      <ReportShell showHomeLink={session !== null}>
        <ReportBody content={sampleReport} access={access} />
      </ReportShell>
    );
  }

  if (session === null) {
    redirect(`/login?next=${encodeURIComponent(`/report?profile=${param.id}`)}`);
  }

  const profile = await getProfile(session.userId, param.id);
  // 없는 프로필과 남의 프로필을 구분하지 않는다 — 구분하면 id 로 존재 여부를 훑을 수 있다.
  if (profile === null) notFound();

  // 결제한 프로필이면 유료 섹션을 연다. 지금은 purchases 에 행을 넣는 코드가 없어
  // 늘 false 지만, /home 카드가 같은 값으로 "전체 리포트" 배지를 띄우므로
  // 두 화면이 어긋나지 않게 여기서도 읽는다.
  const profileAccess: ReportAccess = {
    ...access,
    isPaid: access.isPaid || profile.isPaid,
  };

  return (
    <ReportShell showHomeLink>
      <Suspense fallback={<AnalyzingReport name={profile.name} />}>
        <ProfileReport profile={profile} access={profileAccess} />
      </Suspense>
    </ReportShell>
  );
}
