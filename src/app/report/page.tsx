import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { analyze } from "@/lib/saju-core";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/profiles/store";
import { readCurrentDraft } from "@/lib/drafts/current";
import { createGenerator } from "@/app/api/saju/_lib/generator";
import { GenerationError, produceSections } from "@/app/api/saju/_lib/produce";
import { getCached, putCached } from "@/app/api/saju/_lib/store";
import { getLuckCached, putLuckSections } from "@/app/api/saju/_lib/store-luck";
import { FREE_SECTION_KEYS, SECTION_KEYS, type Interpretation } from "@/app/api/saju/_lib/sections";
import type { InterpretationGenerator } from "@/app/api/saju/_lib/types";
import { getReportAccess, parseProfileParam, type ReportAccess } from "./_lib/access";
import { extractClientIp } from "@/lib/reports/rate-limit";
import { gateAnonGeneration, isRateLimited } from "./_lib/gated-generator";
import { draftToSubject, type ReportSubject } from "./_lib/subject";
import { toBirthInput } from "./_lib/to-birth-input";
import { toReportMeta } from "./_lib/to-meta";
import { toReportContent } from "./_lib/to-report-content";
import { sampleReport } from "./_lib/report-content.fixture";
import { ReportShell } from "./_components/ReportShell";
import { ReportBody } from "./_components/ReportBody";
import { AnalyzingReport } from "./_components/AnalyzingReport";
import { ReportError } from "./_components/ReportError";
import { ReportRateLimited } from "./_components/ReportRateLimited";

/**
 * 캐시 미스면 섹션마다 LLM 을 병렬로 부른다 — /api/saju/route.ts 와 같은 값.
 * 유료 12섹션(무료 4 + 유료 8)은 daeunOutlook 이 느려 이 값을 넘길 수 있다.
 *
 * 2026-08-11 결제가 붙었지만 이 값은 그때 다시 보자던 계획대로 재검토되지
 * 않았다 — 값은 그대로 두었다(호스팅 플랜에 걸린 문제라 아무도 결정하지 않음,
 * docs/issues/backlog.md 결제 연동 후속). 위험은 그대로다: 결제 직후 첫 렌더가
 * 바로 유료 12섹션 경로라 타임아웃 가능성이 가장 높은 순간에 걸리고, 넘기면
 * ProfileReport 가 아니라 ReportError 로 떨어진다(재시도 버튼 있음).
 */
export const maxDuration = 60;

// 첫 요청에서 만든다. 모듈 로드 시점에 만들면 키가 없는 빌드 환경에서 빌드가 깨진다.
let generatorCache: InterpretationGenerator | undefined;
const sharedGenerator = (): InterpretationGenerator => (generatorCache ??= createGenerator());

/** 계산·생성·조립. 여기만 느리므로 이 컴포넌트만 <Suspense> 안에 둔다. */
async function ProfileReport({
  subject,
  profileId,
  access,
  generator,
}: {
  subject: ReportSubject;
  /** 저장된 프로필이면 그 id. 익명 드래프트면 없다 — 결제로 보낼 대상이 아직 없다는 뜻이다. */
  profileId?: string;
  access: ReportAccess;
  /** 비로그인 경로만 한도를 씌운 생성기를 넘긴다 */
  generator: InterpretationGenerator;
}) {
  // ?paid=true를 다시 붙이지 않는다 — 유료 판정은 이제 profile.isPaid(purchases 조인)가
  // 서버에서 내리므로 URL에 실을 이유가 없고, 프로덕션에서는 이 토글이 무시되니
  // 붙여봤자 유료 프로필의 재시도가 무료 리포트로 떨어지는 결과만 낳는다.
  const retryHref = profileId ? `/report?profile=${profileId}` : "/report";

  let analysis;
  try {
    analysis = analyze(toBirthInput(subject));
  } catch (e) {
    console.error("[/report] 원국 계산 실패", e);
    return <ReportError retryHref={retryHref} />;
  }

  const year = new Date().getFullYear();
  let interpretation: Partial<Interpretation>;
  let rateLimited = false;
  try {
    ({ interpretation } = await produceSections(analysis, {
      generator,
      getCached,
      putCached,
      getLuckCached,
      putLuckSections,
      sectionKeys: access.isPaid ? SECTION_KEYS : FREE_SECTION_KEYS,
      year,
    }));
  } catch (e) {
    if (e instanceof GenerationError) {
      // 한도에 걸린 것은 실패가 아니다 — 캐시에 있던 것만으로 이어가되, 보여줄 것이
      // 하나도 없으면 아래에서 다른 문구로 안내한다.
      if (isRateLimited(e)) {
        rateLimited = true;
      } else {
        console.error("[/report] 해석 생성 실패", e);
      }
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
  if (!interpretation.overview) {
    return rateLimited ? <ReportRateLimited /> : <ReportError retryHref={retryHref} />;
  }

  const content = toReportContent(
    analysis,
    interpretation,
    toReportMeta(subject, analysis.chart),
    year,
  );
  return <ReportBody content={content} access={access} profileId={profileId} />;
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

  // 프로필을 가리키지 않은 요청. 계정은 없어도 퍼널을 지나온 사람은 자기 드래프트가
  // 있으므로 실데이터 무료 리포트를 보여준다 — 잠긴 섹션의 CTA 가 로그인·결제로 이어진다.
  // 드래프트도 없으면 지금까지처럼 픽스처 데모다.
  if (param.kind === "absent") {
    const draft = await readCurrentDraft();
    if (draft === null) {
      return (
        <ReportShell showHomeLink={session !== null}>
          <ReportBody content={sampleReport} access={access} />
        </ReportShell>
      );
    }
    return (
      <ReportShell showHomeLink={session !== null}>
        <Suspense fallback={<AnalyzingReport name={draft.name} />}>
          <ProfileReport
            subject={draftToSubject(draft)}
            access={access}
            // 드래프트를 보는 사람이 로그인 상태일 수도 있다(승격이 아직 안 된 경우).
            // 한도는 계정 없는 요청에만 씌운다.
            generator={
              session === null
                ? gateAnonGeneration(sharedGenerator(), extractClientIp(await headers()))
                : sharedGenerator()
            }
          />
        </Suspense>
      </ReportShell>
    );
  }

  if (session === null) {
    redirect(`/login?next=${encodeURIComponent(`/report?profile=${param.id}`)}`);
  }

  const profile = await getProfile(session.userId, param.id);
  // 없는 프로필과 남의 프로필을 구분하지 않는다 — 구분하면 id 로 존재 여부를 훑을 수 있다.
  if (profile === null) notFound();

  // 결제한 프로필이면 유료 섹션을 연다. profile.isPaid 는 purchases 조인에서 온다.
  // /home 카드가 같은 값으로 "전체 리포트" 배지를 띄우므로 두 화면이 어긋나지
  // 않게 여기서도 읽는다.
  const profileAccess: ReportAccess = {
    ...access,
    isPaid: access.isPaid || profile.isPaid,
  };

  return (
    <ReportShell showHomeLink>
      <Suspense fallback={<AnalyzingReport name={profile.name} />}>
        <ProfileReport
          subject={profile}
          profileId={profile.id}
          access={profileAccess}
          generator={sharedGenerator()}
        />
      </Suspense>
    </ReportShell>
  );
}
