# 법률 페이지 (이용약관·개인정보처리방침·사업자정보) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유료 사주 리포트 서비스에 법정 표시 페이지 3종(`/terms`, `/privacy`, `/business`)을 만들고 랜딩 푸터에서 링크한다.

**Architecture:** Next 16 App Router의 라우트 그룹 `(legal)`로 세 정적 서버 컴포넌트 페이지를 묶고 공용 레이아웃/문서 래퍼를 공유한다. 사업자 값은 `_lib/company.ts` 상수 하나에서만 정의해 footer·사업자정보 페이지·약관이 모두 참조한다.

**Tech Stack:** Next 16.2.10 (App Router), React 19, Tailwind v4 (typography 플러그인 없음 — 유틸리티로 직접 스타일), Vitest 4 (node env, `react-dom/server` 로 정적 렌더 후 문자열 단언).

## Global Constraints

- **로케일:** 한국어 하드코딩. i18n 배선 없음.
- **렌더링:** 세 페이지 모두 **동기 서버 컴포넌트** (data fetch·`await`·client hook 없음). `renderToStaticMarkup` 로 테스트하려면 동기여야 한다.
- **사업자 단일 소스:** 상호/대표자/등록번호/주소/통신판매업번호/이메일은 `COMPANY` (`src/app/(legal)/_lib/company.ts`) 에서만 정의한다. 어느 파일에도 이 값들을 다시 문자열로 적지 않는다.
- **통신판매업 신고번호:** 실제 신고 전이므로 값은 `"통신판매업 신고 준비중"`. 상수에 교체 위치 주석 필수.
- **문의 이메일:** `hailmarylabs@gmail.com` (세무서 번호 031-644-0227 은 쓰지 않는다).
- **환불 원칙:** 결제 완료 = 리포트 전체 즉시 제공(잠금 해제)이므로 단순 변심 청약철회 제한, 회사 귀책 시 전액환불.
- **최종 개정일:** `2026-08-12`.
- **테스트 렌더:** `import { renderToStaticMarkup } from "react-dom/server"` (node vitest 에서 `next/link` 도 `<a href>` 로 정상 렌더됨 — 스파이크 확인 완료).
- **커밋 트레일러:** 모든 커밋 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: 사업자정보 단일 소스 `COMPANY`

**Files:**
- Create: `src/app/(legal)/_lib/company.ts`
- Test: `src/app/(legal)/_lib/company.test.ts`

**Interfaces:**
- Produces: `export const COMPANY` — `{ name, ceo, registrationNumber, address, mailOrderSalesNumber, contactEmail, openedOn }` 각 필드 `string`, 객체는 `as const`.

- [ ] **Step 1: Write the failing test**

`src/app/(legal)/_lib/company.test.ts`:
```ts
import { COMPANY } from "./company";

test("사업자 핵심 값이 등록증과 일치한다", () => {
  expect(COMPANY.name).toBe("헤일메리랩스");
  expect(COMPANY.ceo).toBe("김동진");
  expect(COMPANY.registrationNumber).toBe("432-33-01882");
  expect(COMPANY.contactEmail).toBe("hailmarylabs@gmail.com");
});

test("통신판매업 신고번호는 아직 placeholder 다", () => {
  expect(COMPANY.mailOrderSalesNumber).toBe("통신판매업 신고 준비중");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/(legal)/_lib/company.test.ts"`
Expected: FAIL — `Cannot find module "./company"`.

- [ ] **Step 3: Write minimal implementation**

`src/app/(legal)/_lib/company.ts`:
```ts
/**
 * 사업자 정보 단일 출처. footer·/business·약관이 모두 여기서만 읽는다.
 * 값은 사업자등록증명원(헤일메리랩스, 2026-08-12 발급) 기준.
 */
export const COMPANY = {
  name: "헤일메리랩스",
  ceo: "김동진",
  registrationNumber: "432-33-01882",
  address: "경기도 이천시 경충대로2762번길 29-107, 102-S21호 (관고동)",
  // TODO(통신판매업): 신고 완료 후 실제 번호로 교체. 예: "제2026-경기이천-0000호"
  mailOrderSalesNumber: "통신판매업 신고 준비중",
  contactEmail: "hailmarylabs@gmail.com",
  openedOn: "2026-08-05",
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/(legal)/_lib/company.test.ts"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(legal)/_lib/company.ts" "src/app/(legal)/_lib/company.test.ts"
git commit -m "feat(legal): 사업자정보 단일 소스 상수를 추가한다

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 공용 레이아웃 + 문서 래퍼

**Files:**
- Create: `src/app/(legal)/layout.tsx`
- Create: `src/app/(legal)/_components/LegalPage.tsx`
- Test: `src/app/(legal)/_components/LegalPage.test.tsx`

**Interfaces:**
- Consumes: 없음.
- Produces:
  - `layout.tsx` — default export `LegalLayout({ children }: { children: React.ReactNode })`, 서버 컴포넌트. 상단에 홈(`/`) 링크, 본문을 `max-w-[720px]` 로 가운데 정렬.
  - `LegalPage.tsx` — `export function LegalPage({ title, updatedAt, children }: { title: string; updatedAt: string; children: React.ReactNode })`. 제목 h1 + "최종 개정일: {updatedAt}" + prose 스타일 본문 래퍼.

- [ ] **Step 1: Write the failing test**

`src/app/(legal)/_components/LegalPage.test.tsx`:
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { LegalPage } from "./LegalPage";

test("제목·개정일·본문을 렌더한다", () => {
  const html = renderToStaticMarkup(
    <LegalPage title="이용약관" updatedAt="2026-08-12">
      <p>본문 문단</p>
    </LegalPage>,
  );
  expect(html).toContain("이용약관");
  expect(html).toContain("최종 개정일");
  expect(html).toContain("2026-08-12");
  expect(html).toContain("본문 문단");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/(legal)/_components/LegalPage.test.tsx"`
Expected: FAIL — `Cannot find module "./LegalPage"`.

- [ ] **Step 3: Write minimal implementation**

`src/app/(legal)/_components/LegalPage.tsx`:
```tsx
export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <article>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">최종 개정일: {updatedAt}</p>
      <div className="mt-8 text-[15px] leading-7 text-slate-700 [&_h2]:mt-9 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1 [&_a]:text-accent [&_a]:underline">
        {children}
      </div>
    </article>
  );
}
```

`src/app/(legal)/layout.tsx`:
```tsx
import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <header className="border-b border-slate-100">
        <div className="max-w-[720px] mx-auto px-6 h-14 flex items-center">
          <Link href="/" className="font-semibold text-slate-900 hover:opacity-80">
            사주대소
          </Link>
        </div>
      </header>
      <main className="max-w-[720px] mx-auto px-6 py-12">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/(legal)/_components/LegalPage.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(legal)/layout.tsx" "src/app/(legal)/_components/LegalPage.tsx" "src/app/(legal)/_components/LegalPage.test.tsx"
git commit -m "feat(legal): 법률 페이지 공용 레이아웃과 문서 래퍼를 추가한다

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 사업자정보 페이지 `/business`

**Files:**
- Create: `src/app/(legal)/business/page.tsx`
- Test: `src/app/(legal)/business/page.test.tsx`

**Interfaces:**
- Consumes: `COMPANY` (Task 1), `LegalPage` (Task 2).
- Produces: default export `BusinessInfoPage()` (동기 서버 컴포넌트) + `export const metadata`.

- [ ] **Step 1: Write the failing test**

`src/app/(legal)/business/page.test.tsx`:
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import BusinessInfoPage from "./page";

test("법정 표시 항목이 화면에 있다", () => {
  const html = renderToStaticMarkup(<BusinessInfoPage />);
  expect(html).toContain("헤일메리랩스");
  expect(html).toContain("432-33-01882");
  expect(html).toContain("김동진");
  expect(html).toContain("hailmarylabs@gmail.com");
  expect(html).toContain("통신판매업 신고 준비중");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/(legal)/business/page.test.tsx"`
Expected: FAIL — `Cannot find module "./page"`.

- [ ] **Step 3: Write minimal implementation**

`src/app/(legal)/business/page.tsx`:
```tsx
import type { Metadata } from "next";
import { LegalPage } from "../_components/LegalPage";
import { COMPANY } from "../_lib/company";

export const metadata: Metadata = {
  title: "사업자정보 | 사주대소",
  description: "헤일메리랩스 사업자 정보",
};

const ROWS: [string, string][] = [
  ["상호", COMPANY.name],
  ["대표자", COMPANY.ceo],
  ["사업자등록번호", COMPANY.registrationNumber],
  ["주소", COMPANY.address],
  ["통신판매업 신고번호", COMPANY.mailOrderSalesNumber],
  ["고객문의", COMPANY.contactEmail],
];

export default function BusinessInfoPage() {
  return (
    <LegalPage title="사업자정보" updatedAt="2026-08-12">
      <table className="w-full text-[15px] border-collapse">
        <tbody>
          {ROWS.map(([label, value]) => (
            <tr key={label} className="border-b border-slate-100 align-top">
              <th className="text-left font-medium text-slate-500 py-3 pr-4 w-[140px] whitespace-nowrap">
                {label}
              </th>
              <td className="py-3 text-slate-800">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-6 text-sm text-slate-400">
        사업자등록번호는 국세청 홈택스(www.hometax.go.kr)에서 조회·확인할 수 있습니다.
      </p>
    </LegalPage>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/(legal)/business/page.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(legal)/business/page.tsx" "src/app/(legal)/business/page.test.tsx"
git commit -m "feat(legal): 사업자정보 페이지를 추가한다

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: 이용약관 페이지 `/terms`

**Files:**
- Create: `src/app/(legal)/terms/page.tsx`
- Test: `src/app/(legal)/terms/page.test.tsx`

**Interfaces:**
- Consumes: `COMPANY` (Task 1), `LegalPage` (Task 2).
- Produces: default export `TermsPage()` (동기 서버 컴포넌트) + `export const metadata`.

- [ ] **Step 1: Write the failing test**

`src/app/(legal)/terms/page.test.tsx`:
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import TermsPage from "./page";

test("청약철회 제한과 회사 귀책 환불 예외를 고지한다", () => {
  const html = renderToStaticMarkup(<TermsPage />);
  expect(html).toContain("청약철회");
  expect(html).toContain("즉시 제공");
  expect(html).toContain("회사의 귀책");
  expect(html).toContain("hailmarylabs@gmail.com");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/(legal)/terms/page.test.tsx"`
Expected: FAIL — `Cannot find module "./page"`.

- [ ] **Step 3: Write minimal implementation**

`src/app/(legal)/terms/page.tsx`:
```tsx
import type { Metadata } from "next";
import { LegalPage } from "../_components/LegalPage";
import { COMPANY } from "../_lib/company";

export const metadata: Metadata = {
  title: "이용약관 | 사주대소",
  description: "사주대소 서비스 이용약관",
};

export default function TermsPage() {
  return (
    <LegalPage title="이용약관" updatedAt="2026-08-12">
      <h2>제1조 (목적)</h2>
      <p>
        이 약관은 {COMPANY.name}(이하 &ldquo;회사&rdquo;)이 제공하는 사주 리포트 서비스(이하
        &ldquo;서비스&rdquo;)의 이용과 관련하여 회사와 이용자의 권리·의무 및 책임사항을 규정함을
        목적으로 합니다.
      </p>

      <h2>제2조 (정의 및 서비스의 성격)</h2>
      <p>
        &ldquo;서비스&rdquo;란 이용자가 입력한 생년월일시 등을 바탕으로 사주 원국을 계산하고 AI가
        해석 리포트를 생성·제공하는 것을 말합니다. 서비스가 제공하는 해석은 자기 이해와 오락을 위한
        참고 정보이며, 의료·법률·재무 등 전문적 상담이나 미래에 대한 확정적 예측이 아닙니다.
      </p>

      <h2>제3조 (이용계약의 성립)</h2>
      <p>
        이용계약은 이용자가 소셜 로그인 등 회사가 정한 방법으로 가입하고 이 약관에 동의함으로써
        성립합니다.
      </p>

      <h2>제4조 (유료 서비스 및 결제)</h2>
      <p>
        리포트의 잠금 해제(전체 열람)는 유료입니다. 결제는 회사가 지정한 결제대행사(PortOne 및
        연동 PG)를 통한 카드·간편결제 등으로 이루어지며, 이용자는 결제 전 상품과 가격, 환불 조건을
        확인합니다.
      </p>

      <h2>제5조 (청약철회 및 환불)</h2>
      <p>
        리포트는 <strong>결제 완료와 동시에 전체(잠금 해제)가 즉시 제공</strong>됩니다. 이는
        「전자상거래 등에서의 소비자보호에 관한 법률」 제17조 제2항 제5호 및 같은 항 단서에서 정한,
        제공이 개시된 디지털 콘텐츠에 해당하므로, 결제 후 단순 변심에 의한 청약철회 및 환불은
        제한됩니다. 회사는 결제 전에 이 사실을 고지합니다.
      </p>
      <p>
        다만 <strong>회사의 귀책사유</strong>(리포트가 제공되지 않은 경우, 중대한 생성 오류, 중복
        결제 등)로 인한 경우에는 전액 환불합니다. 환불 및 관련 문의는{" "}
        <a href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a> 로 접수합니다.
      </p>

      <h2>제6조 (이용자의 의무)</h2>
      <p>
        이용자는 타인의 정보를 도용하거나 허위 정보를 입력해서는 안 되며, 서비스 이용 과정에서
        관계 법령과 이 약관을 준수해야 합니다.
      </p>

      <h2>제7조 (책임의 한계)</h2>
      <p>
        회사는 리포트 해석의 정확성이나 특정 결과를 보장하지 않습니다. 서비스는 참고용으로
        제공되며, 이용자가 리포트를 근거로 내린 판단과 그 결과에 대한 책임은 이용자에게 있습니다.
      </p>

      <h2>제8조 (준거법 및 분쟁 해결)</h2>
      <p>
        이 약관은 대한민국 법에 따라 해석되며, 서비스 이용과 관련한 분쟁에 대하여는 관계 법령이
        정한 절차에 따릅니다.
      </p>
    </LegalPage>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/(legal)/terms/page.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(legal)/terms/page.tsx" "src/app/(legal)/terms/page.test.tsx"
git commit -m "feat(legal): 이용약관 페이지를 추가한다

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: 개인정보처리방침 페이지 `/privacy`

**Files:**
- Create: `src/app/(legal)/privacy/page.tsx`
- Test: `src/app/(legal)/privacy/page.test.tsx`

**Interfaces:**
- Consumes: `COMPANY` (Task 1), `LegalPage` (Task 2).
- Produces: default export `PrivacyPage()` (동기 서버 컴포넌트) + `export const metadata`.

- [ ] **Step 1: Write the failing test**

`src/app/(legal)/privacy/page.test.tsx`:
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import PrivacyPage from "./page";

test("수집 항목·위탁·문의처를 고지한다", () => {
  const html = renderToStaticMarkup(<PrivacyPage />);
  expect(html).toContain("수집");
  expect(html).toContain("위탁");
  expect(html).toContain("생년월일시");
  expect(html).toContain("hailmarylabs@gmail.com");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/(legal)/privacy/page.test.tsx"`
Expected: FAIL — `Cannot find module "./page"`.

- [ ] **Step 3: Write minimal implementation**

`src/app/(legal)/privacy/page.tsx`:
```tsx
import type { Metadata } from "next";
import { LegalPage } from "../_components/LegalPage";
import { COMPANY } from "../_lib/company";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 사주대소",
  description: "사주대소 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보처리방침" updatedAt="2026-08-12">
      <p>
        {COMPANY.name}(이하 &ldquo;회사&rdquo;)은 이용자의 개인정보를 중요하게 여기며, 「개인정보
        보호법」 등 관계 법령을 준수합니다. 회사가 처리하는 개인정보의 항목과 목적은 다음과 같습니다.
      </p>

      <h2>1. 수집하는 개인정보 항목</h2>
      <ul>
        <li>소셜 로그인 계정 식별자, 이메일, 닉네임</li>
        <li>사주 계산을 위한 입력값: 생년월일시, 성별, (선택) 출생지</li>
        <li>결제 관련 정보: 거래·주문 식별자 (카드 정보 등은 결제대행사가 처리하며 회사는 보관하지 않습니다)</li>
      </ul>

      <h2>2. 개인정보의 이용 목적</h2>
      <ul>
        <li>사주 리포트의 생성·제공</li>
        <li>결제 및 환불 처리</li>
        <li>문의 응대 및 서비스 운영</li>
      </ul>

      <h2>3. 보유 및 이용 기간</h2>
      <p>
        회원 탈퇴 시 지체 없이 파기하는 것을 원칙으로 합니다. 다만 「전자상거래 등에서의 소비자보호에
        관한 법률」 등 관계 법령에 따라 보존이 필요한 거래·결제 기록은 해당 법령이 정한 기간 동안
        보관합니다.
      </p>

      <h2>4. 개인정보 처리의 위탁</h2>
      <p>회사는 서비스 제공을 위해 아래와 같이 개인정보 처리를 위탁합니다.</p>
      <ul>
        <li>PortOne 및 연동 결제대행사(KG이니시스 등): 결제·환불 처리</li>
        <li>Neon: 데이터베이스 저장·운영</li>
        <li>Upstash: 세션 관리</li>
        <li>소셜 로그인 제공자(카카오·LINE·Google): 로그인 인증</li>
      </ul>

      <h2>5. 정보주체의 권리</h2>
      <p>
        이용자는 자신의 개인정보에 대해 열람·정정·삭제·처리정지를 요구할 수 있으며,{" "}
        <a href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a> 로 요청할 수 있습니다.
      </p>

      <h2>6. 개인정보의 파기</h2>
      <p>
        보유 기간이 지나거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다. 전자적 파일은
        복구할 수 없는 방법으로 삭제합니다.
      </p>

      <h2>7. 개인정보 보호책임자</h2>
      <p>
        성명: {COMPANY.ceo} / 연락처:{" "}
        <a href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a>
      </p>

      <h2>8. 고지의 의무</h2>
      <p>이 방침의 내용이 변경되는 경우 변경 사항을 서비스 내 공지를 통해 알립니다.</p>
    </LegalPage>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/(legal)/privacy/page.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(legal)/privacy/page.tsx" "src/app/(legal)/privacy/page.test.tsx"
git commit -m "feat(legal): 개인정보처리방침 페이지를 추가한다

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: 랜딩 푸터에 법률 링크 추가

**Files:**
- Modify: `src/app/_components/FooterCta.tsx`
- Test: `src/app/_components/FooterCta.test.tsx`

**Interfaces:**
- Consumes: 라우트 `/terms`, `/privacy`, `/business` (Task 3–5).
- Produces: 없음 (기존 `FooterCta` 컴포넌트에 링크만 추가).

기존 파일의 하단 바 (현재 로고 + 태그라인이 있는 `<div className="border-t border-slate-800">` 블록)에 링크 행을 추가한다. 아래 Step 3 은 `border-t` 블록 전체를 교체하는 형태로 보여준다.

- [ ] **Step 1: Write the failing test**

`src/app/_components/FooterCta.test.tsx`:
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { FooterCta } from "./FooterCta";

test("법률 페이지 링크 3개를 노출한다", () => {
  const html = renderToStaticMarkup(<FooterCta />);
  expect(html).toContain('href="/terms"');
  expect(html).toContain('href="/privacy"');
  expect(html).toContain('href="/business"');
  expect(html).toContain("개인정보처리방침");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/_components/FooterCta.test.tsx`
Expected: FAIL — `href="/terms"` 등이 없음.

- [ ] **Step 3: Modify implementation**

`src/app/_components/FooterCta.tsx` 의 `<div className="border-t border-slate-800">` 블록을 아래로 교체:
```tsx
      <div className="border-t border-slate-800">
        <div className="max-w-[1120px] mx-auto px-8 py-7 flex items-center justify-between flex-wrap gap-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-[26px] h-[26px] rounded-lg bg-white flex items-center justify-center text-slate-900 font-semibold text-[13px]">
              사
            </div>
            <span className="font-semibold text-[14.5px]">사주</span>
          </div>
          <nav className="flex items-center gap-4 text-[13px] text-slate-400">
            <Link href="/terms" className="hover:text-white">
              이용약관
            </Link>
            <Link href="/privacy" className="font-semibold hover:text-white">
              개인정보처리방침
            </Link>
            <Link href="/business" className="hover:text-white">
              사업자정보
            </Link>
          </nav>
        </div>
        <div className="max-w-[1120px] mx-auto px-8 pb-7 text-[13px] text-slate-500">
          나를 더 깊이 이해하는 가장 차분한 방법.
        </div>
      </div>
```
(기존 태그라인 `나를 더 깊이 이해하는...` 은 링크 행과 겹치지 않도록 아래 줄로 내렸다. `Link` 는 파일 상단에서 이미 import 되어 있다.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/_components/FooterCta.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/_components/FooterCta.tsx src/app/_components/FooterCta.test.tsx
git commit -m "feat(legal): 랜딩 푸터에 법률 페이지 링크를 추가한다

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: 전체 검증

**Files:** 없음 (검증만).

- [ ] **Step 1: 타입체크**

Run: `npm run typecheck`
Expected: 오류 없음.

- [ ] **Step 2: 린트**

Run: `npm run lint`
Expected: 오류 없음.

- [ ] **Step 3: 전체 테스트**

Run: `npm run test`
Expected: 신규 테스트 포함 전부 PASS.

- [ ] **Step 4: 실제 라우트 육안 확인**

Run: `npm run dev` 후 브라우저로 `/terms`, `/privacy`, `/business` 및 랜딩 푸터 링크 확인. 세 페이지가 열리고 사업자 값·환불 문구·문의 이메일이 보이는지 확인.

---

## Self-Review

**Spec coverage:**
- 라우팅 3개 별도 라우트 → Task 2–5. ✓
- 사업자정보 단일 소스 → Task 1. ✓
- 이용약관(환불 포함) → Task 4. ✓
- 개인정보처리방침(수집·위탁·권리) → Task 5. ✓
- 사업자정보 페이지 → Task 3. ✓
- 통신판매업 placeholder → Task 1 상수 + Task 3 렌더. ✓
- 랜딩 푸터 링크 → Task 6. ✓
- 테스트(스모크·법정 표시 항목·링크 href) → 각 Task Step 1 + Task 7. ✓
- 환불 문구 = 즉시 제공/청약철회 제한/회사 귀책 환불 → Task 4. ✓

**Placeholder scan:** 코드 스텝은 모두 실제 내용. `mailOrderSalesNumber` 의 `"통신판매업 신고 준비중"` 은 스펙이 지정한 의도된 임시값(사용자 승인). ✓

**Type consistency:** `COMPANY` 필드명(`name`/`ceo`/`registrationNumber`/`address`/`mailOrderSalesNumber`/`contactEmail`/`openedOn`)이 Task 1 정의와 Task 3–5 사용에서 일치. `LegalPage` props(`title`/`updatedAt`/`children`)가 Task 2 정의와 Task 3–5 사용에서 일치. ✓
