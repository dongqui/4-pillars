# 로딩 UI 통일 · CTA 커서 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오래 걸리는 CTA 와 LLM 대기 화면을 단계 진행형 `LoadingScreen` 하나로 통일하고, 버튼 커서를 전역으로 바로잡는다.

**Architecture:** 순수 함수(`progress.ts`)가 경과 시간 → 추정 진행률·현재 단계를 계산하고, 클라이언트 컴포넌트 `LoadingScreen` 이 `page`(Suspense fallback) / `overlay`(클릭 직후 전체 화면) 두 모양으로 그린다. overlay 가 sessionStorage 에 시작 시각을 남기면 이어지는 page fallback 이 진행률을 이어받는다.

**Tech Stack:** Next 16.2.10 (App Router, RSC Suspense), React 19.2, Tailwind v4, vitest(node 환경 — DOM 테스트 없음).

## Global Constraints

- 진행 바는 시간 기반 추정치이며 **92% 에서 멈춘다**. 완료 전에 100% 를 보이지 않는다.
- 색은 accent(`#2563eb`, `bg-accent`/`text-accent`), 글꼴 Pretendard(전역). 시안 인디고 `#4F46E5` 는 쓰지 않는다.
- 새 애니메이션 클래스는 `globals.css` 의 `prefers-reduced-motion` 목록에 넣는다.
- `role="status"` + `aria-live="polite"`.
- overlay 는 402/401 리다이렉트·오류 경로에서 띄우지 않거나 즉시 닫는다.
- 상담 채팅 전송, 결제, 짧은 저장·삭제 버튼은 버튼 로딩 유지. 퍼널 `CalculatingScreen`·Reveal 은 건드리지 않는다.
- 커밋 메시지 끝: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## File Structure

- Create `src/components/loading/progress.ts` — 진행률·단계·핸드오프 순수 함수
- Create `src/components/loading/progress.test.ts`
- Create `src/components/loading/presets.ts` — 화면별 제목·단계·예상 시간·팁
- Create `src/components/loading/LoadingScreen.tsx` — 화면
- Modify `src/app/globals.css` — `ld-*` 애니메이션, reduced-motion, 전역 커서
- Modify `src/app/report/page.tsx`, `src/app/match/[id]/page.tsx`, `src/app/flow/[id]/page.tsx` — fallback 교체
- Delete `src/app/report/_components/AnalyzingReport.tsx`, `src/app/flow/[id]/_components/AnalyzingFlow.tsx`; `AnalyzingMatch.tsx` 에서 `AnalyzingMatch` 만 제거
- Modify `src/app/report/_hooks/use-unlock.ts`, `src/app/report/_components/LockedSections.tsx`
- Modify `src/app/consult/_components/ConsultBoard.tsx`
- Modify `src/app/match/_components/MatchForm.tsx`
- Modify `src/app/flow/_components/FlowConfirm.tsx`, `src/app/flow/_components/SituationSheet.tsx`
- Modify `src/components/Button.tsx`, `src/app/login/_components/SocialLoginButton.tsx`

---

### Task 1: 진행률 순수 함수

**Files:**
- Create: `src/components/loading/progress.ts`
- Test: `src/components/loading/progress.test.ts`

**Interfaces:**
- Produces: `PROGRESS_CAP: number`, `estimateProgress(elapsedMs: number, expectedMs: number): number`, `activeStepIndex(progress: number, stepCount: number): number`, `HANDOFF_KEY: string`, `resolveStartedAt(stored: string | null, now: number): number`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, expect, test } from "vitest";
import {
  PROGRESS_CAP,
  activeStepIndex,
  estimateProgress,
  resolveStartedAt,
} from "./progress";

describe("estimateProgress", () => {
  test("시작은 0", () => {
    expect(estimateProgress(0, 30_000)).toBe(0);
    expect(estimateProgress(-5, 30_000)).toBe(0);
  });
  test("예상 시간쯤이면 80% 를 넘는다", () => {
    expect(estimateProgress(30_000, 30_000)).toBeGreaterThan(0.8);
  });
  test("아무리 오래 걸려도 상한을 넘지 않는다 — 끝나지 않았는데 100% 를 보이지 않는다", () => {
    expect(estimateProgress(10 * 60_000, 30_000)).toBeLessThanOrEqual(PROGRESS_CAP);
    expect(PROGRESS_CAP).toBe(0.92);
  });
  test("단조 증가", () => {
    expect(estimateProgress(2_000, 30_000)).toBeLessThan(estimateProgress(4_000, 30_000));
  });
});

describe("activeStepIndex", () => {
  test("0 이면 첫 단계", () => {
    expect(activeStepIndex(0, 5)).toBe(0);
  });
  test("상한에 닿으면 마지막 단계에 머문다", () => {
    expect(activeStepIndex(PROGRESS_CAP, 5)).toBe(4);
  });
  test("중간", () => {
    expect(activeStepIndex(PROGRESS_CAP / 2, 4)).toBe(2);
  });
});

describe("resolveStartedAt", () => {
  const now = 1_000_000;
  test("저장값이 없으면 지금", () => {
    expect(resolveStartedAt(null, now)).toBe(now);
  });
  test("15초 안의 저장값은 이어받는다", () => {
    expect(resolveStartedAt(String(now - 3_000), now)).toBe(now - 3_000);
  });
  test("오래됐거나 미래거나 깨진 값은 버린다", () => {
    expect(resolveStartedAt(String(now - 20_000), now)).toBe(now);
    expect(resolveStartedAt(String(now + 5_000), now)).toBe(now);
    expect(resolveStartedAt("abc", now)).toBe(now);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/components/loading/progress.test.ts` → 모듈 없음으로 FAIL

- [ ] **Step 3: 구현**

```ts
/**
 * 로딩 화면의 진행률은 추정치다 — 서버는 LLM 생성이 얼마나 됐는지 알려주지 않는다.
 * 처음엔 빠르게, 갈수록 느리게 차고 PROGRESS_CAP 에서 멈춘다. 끝나지 않았는데
 * 100% 를 보이면 사용자는 멈춘 것으로 읽는다.
 */
export const PROGRESS_CAP = 0.92;

export function estimateProgress(elapsedMs: number, expectedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return PROGRESS_CAP * (1 - Math.exp((-2.5 * elapsedMs) / expectedMs));
}

export function activeStepIndex(progress: number, stepCount: number): number {
  return Math.min(stepCount - 1, Math.floor((progress / PROGRESS_CAP) * stepCount));
}

/**
 * 클릭 직후 overlay 와 도착 페이지의 Suspense fallback 은 서로 다른 인스턴스다.
 * overlay 가 시작 시각을 남기면 fallback 이 이어받아 진행 바가 0 으로 되돌아가지 않는다.
 */
export const HANDOFF_KEY = "loading:startedAt";
const HANDOFF_WINDOW_MS = 15_000;

export function resolveStartedAt(stored: string | null, now: number): number {
  if (stored === null) return now;
  const t = Number(stored);
  if (!Number.isFinite(t)) return now;
  const age = now - t;
  return age >= 0 && age < HANDOFF_WINDOW_MS ? t : now;
}
```

- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS
- [ ] **Step 5: 커밋** — `git add src/components/loading/progress*.ts && git commit -m "feat(loading): 추정 진행률 계산"`

---

### Task 2: LoadingScreen 컴포넌트 · 프리셋 · 애니메이션

**Files:**
- Create: `src/components/loading/presets.ts`, `src/components/loading/LoadingScreen.tsx`
- Modify: `src/app/globals.css` (keyframes 추가, reduced-motion 목록 `:289` 블록)

**Interfaces:**
- Consumes: Task 1 전부
- Produces: `type LoadingPresetKey = "report" | "match" | "flow" | "consult"`, `<LoadingScreen preset={LoadingPresetKey} variant?: "page" | "overlay" title?: string />`

- [ ] **Step 1: presets.ts**

```ts
export type LoadingStep = { label: string; sub: string };
export type LoadingPreset = {
  title: string;
  note: string;
  expectedMs: number;
  steps: LoadingStep[];
};
export type LoadingPresetKey = "report" | "match" | "flow" | "consult";

const FIRST_TIME = "처음 한 번만 조금 걸려요. 다음부터는 바로 열려요.";
const WRAP_UP: LoadingStep = { label: "마무리", sub: "읽기 좋은 순서로 정리하고 있어요" };

export const LOADING_PRESETS: Record<LoadingPresetKey, LoadingPreset> = {
  report: {
    title: "리포트를 쓰고 있어요",
    note: FIRST_TIME,
    expectedMs: 40_000,
    steps: [
      { label: "만세력 변환", sub: "생년월일시를 절기 기준으로 옮기고 있어요" },
      { label: "사주 여덟 글자 세우기", sub: "연주 · 월주 · 일주 · 시주" },
      { label: "오행과 십신 살피기", sub: "강한 기운과 부족한 기운을 찾고 있어요" },
      { label: "해석문 작성", sub: "성향 · 관계 · 재물 · 운의 흐름" },
      WRAP_UP,
    ],
  },
  match: {
    title: "궁합을 풀어보고 있어요",
    note: FIRST_TIME,
    expectedMs: 30_000,
    steps: [
      { label: "두 사람의 사주 세우기", sub: "각자의 여덟 글자를 펼치고 있어요" },
      { label: "오행 궁합 살피기", sub: "서로 채우는 기운과 부딪히는 기운" },
      { label: "관계 해석 작성", sub: "고른 관계에 맞춰 풀고 있어요" },
      WRAP_UP,
    ],
  },
  flow: {
    title: "흐름을 풀어보고 있어요",
    note: FIRST_TIME,
    expectedMs: 30_000,
    steps: [
      { label: "대운·세운 살피기", sub: "그해에 들어오는 기운을 겹쳐 보고 있어요" },
      { label: "월별 흐름 짚기", sub: "조심할 달과 잘 흐를 달" },
      { label: "해석문 작성", sub: "내 사주에 맞춰 풀고 있어요" },
      WRAP_UP,
    ],
  },
  consult: {
    title: "상담사가 사주를 읽고 있어요",
    note: "첫 답변을 쓰는 데 10초쯤 걸려요",
    expectedMs: 12_000,
    steps: [
      { label: "사주 읽기", sub: "원국을 펼치고 있어요" },
      { label: "고민 정리", sub: "적어 주신 내용을 짚고 있어요" },
      { label: "첫 답변 작성", sub: "곧 대화방으로 넘어가요" },
    ],
  },
};

export const LOADING_TIPS = [
  "사주는 태어난 순간의 기운을 여덟 글자로 옮긴 기록이에요. 정해진 운명이 아니라, 타고난 성향과 흐름을 읽는 지도에 가깝습니다.",
  "태어난 시간을 모르면 시주(時柱)를 세울 수 없어요. 시간을 아는 것만으로 해석의 정확도가 크게 올라갑니다.",
  "오행이 완벽하게 균형 잡힌 사주는 드물어요. 부족한 기운을 어떻게 채우는지가 사주 해석의 핵심입니다.",
  "대운은 10년 단위로 바뀌는 큰 흐름이에요. 같은 사주라도 지금 어느 대운에 있는지에 따라 다르게 읽힙니다.",
];
```

- [ ] **Step 2: LoadingScreen.tsx**

```tsx
"use client";
import { useEffect, useState } from "react";
import {
  HANDOFF_KEY,
  activeStepIndex,
  estimateProgress,
  resolveStartedAt,
} from "./progress";
import { LOADING_PRESETS, LOADING_TIPS, type LoadingPresetKey } from "./presets";

const TICK_MS = 200;
const TIP_MS = 4_600;

/**
 * 오래 걸리는 LLM 대기의 공용 화면. 시안: design/project/Saju Report Loading.dc.html.
 *
 * - page: Suspense fallback. 셸 <main> 안에 들어가므로 높이를 강제하지 않는다.
 * - overlay: CTA 를 누른 직후 화면 전체를 덮는다. 도착 페이지의 page fallback 이
 *   시작 시각을 이어받는다(progress.ts 의 HANDOFF_KEY).
 */
export function LoadingScreen({
  preset,
  variant = "page",
  title,
}: {
  preset: LoadingPresetKey;
  variant?: "page" | "overlay";
  title?: string;
}) {
  const p = LOADING_PRESETS[preset];
  // SSR 과 첫 하이드레이션이 같게 0 에서 시작한다 — 시각은 effect 에서만 읽는다.
  const [elapsed, setElapsed] = useState(0);
  const [tip, setTip] = useState(0);

  useEffect(() => {
    const now = Date.now();
    let startedAt = now;
    try {
      if (variant === "overlay") {
        sessionStorage.setItem(HANDOFF_KEY, String(now));
      } else {
        startedAt = resolveStartedAt(sessionStorage.getItem(HANDOFF_KEY), now);
        sessionStorage.removeItem(HANDOFF_KEY);
      }
    } catch {
      // 저장소를 막은 브라우저 — 이어받지 못할 뿐 화면은 그대로 돈다.
    }
    const tick = () => setElapsed(Date.now() - startedAt);
    tick();
    const t = setInterval(tick, TICK_MS);
    const tipT = setInterval(() => setTip((i) => (i + 1) % LOADING_TIPS.length), TIP_MS);
    return () => {
      clearInterval(t);
      clearInterval(tipT);
    };
  }, [variant]);

  const progress = estimateProgress(elapsed, p.expectedMs);
  const active = activeStepIndex(progress, p.steps.length);
  const pct = Math.round(progress * 100);

  const body = (
    <div role="status" aria-live="polite" className="mx-auto w-full max-w-[520px] px-6">
      <div className="relative mx-auto mb-8 h-[120px] w-[120px]">
        <div className="ld-breathe absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(37,99,235,.16),rgba(37,99,235,0)_68%)]" />
        <div className="absolute inset-[14px] rounded-full border-[1.5px] border-accent-100" />
        <div className="ld-spin absolute inset-[14px] rounded-full border-2 border-transparent border-t-accent" />
        <div className="absolute inset-0 flex items-center justify-center text-[26px] font-bold tracking-[-0.04em] text-accent tabular-nums">
          {pct}%
        </div>
      </div>

      <div className="mb-7 text-center">
        <h2 className="m-0 mb-2 text-[clamp(21px,4vw,25px)] font-bold tracking-[-0.035em] [text-wrap:balance]">
          {title ?? p.title}
        </h2>
        <p className="m-0 text-[14.5px] text-slate-400">{p.note}</p>
      </div>

      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-400 transition-[width] duration-200 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="m-0 mb-5 list-none rounded-[20px] border border-slate-100 bg-white px-[22px] py-2 shadow-[0_1px_3px_rgba(17,24,39,.04)]">
        {p.steps.map((s, i) => {
          const done = i < active;
          const now = i === active;
          return (
            <li
              key={s.label}
              className="flex items-start gap-[13px] border-b border-slate-50 py-[14px] last:border-b-0"
            >
              <span
                aria-hidden
                className={`mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full text-[11px] font-bold ${
                  done
                    ? "bg-accent text-white"
                    : now
                      ? "ld-spin border-2 border-accent border-t-transparent"
                      : "border border-slate-100 bg-slate-50"
                }`}
              >
                {done ? "✓" : ""}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-[15px] tracking-[-0.01em] ${
                    done || now ? "font-semibold text-slate-900" : "font-medium text-slate-300"
                  }`}
                >
                  {s.label}
                </span>
                {now && <span className="ld-rise mt-0.5 block text-[13px] text-slate-400">{s.sub}</span>}
              </span>
              {done && <span className="flex-none text-[12.5px] font-semibold text-slate-300">완료</span>}
            </li>
          );
        })}
      </ol>

      <div className="rounded-[20px] border border-slate-100 bg-white px-[22px] py-5 shadow-[0_1px_3px_rgba(17,24,39,.04)]">
        <div className="mb-2.5 flex items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-[12px] font-bold tracking-[0.04em] text-accent">알고 계셨나요</span>
        </div>
        <p key={tip} className="ld-rise m-0 min-h-[51px] text-[15px] leading-[1.7] text-slate-700 [text-wrap:pretty]">
          {LOADING_TIPS[tip]}
        </p>
        <div aria-hidden className="mt-3.5 flex gap-[5px]">
          {LOADING_TIPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === tip ? "w-[18px] bg-accent" : "w-1.5 bg-slate-200"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );

  if (variant === "overlay") {
    return (
      <div className="saju-fade fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-white py-[clamp(32px,6vw,64px)]">
        {body}
      </div>
    );
  }
  return <div className="py-[clamp(40px,8vw,80px)]">{body}</div>;
}
```

- [ ] **Step 3: globals.css** — `pc-plus` 정의 뒤, reduced-motion 블록 앞에 추가:

```css
/* 공용 로딩 화면(src/components/loading). 시안의 om-* 를 앱 색으로 옮긴 것이다. */
@keyframes ld-spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes ld-breathe {
  0%,
  100% {
    transform: scale(0.94);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.04);
    opacity: 1;
  }
}
@keyframes ld-rise {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.ld-spin {
  animation: ld-spin 1.1s linear infinite;
}
.ld-breathe {
  animation: ld-breathe 3.4s ease-in-out infinite;
}
.ld-rise {
  animation: ld-rise 0.35s ease-out both;
}
```

reduced-motion 목록의 `.pc-plus` 앞에 `.ld-spin, .ld-breathe, .ld-rise,` 를 넣는다. (`ld-spin` 이 멈춰도 진행 바와 % 숫자가 정보를 나른다.)

- [ ] **Step 4:** `npm run typecheck` → 오류 없음
- [ ] **Step 5: 커밋** — `feat(loading): 단계 진행형 공용 로딩 화면`

---

### Task 3: Suspense fallback 교체

**Files:** `src/app/report/page.tsx:25,147,182`, `src/app/match/[id]/page.tsx:29,135`, `src/app/flow/[id]/page.tsx:47,122,154`, 삭제 2, `AnalyzingMatch.tsx` 수정

**Interfaces:** Consumes `LoadingScreen` (Task 2)

- [ ] **Step 1: report** — import 를 `import { LoadingScreen } from "@/components/loading/LoadingScreen";` 로 바꾸고 두 fallback 을 `<LoadingScreen preset="report" />` 로. 이름은 넘기지 않는다(단계 카드가 대신 맥락을 준다).
- [ ] **Step 2: match** — import 를 `import { AnalyzingRestOfMatch } from "./_components/AnalyzingMatch";` + `LoadingScreen` 으로, `:135` 의 `<AnalyzingMatch />` → `<LoadingScreen preset="match" />`. `AnalyzingMatch.tsx` 에서 `AnalyzingMatch` 함수와 그 주석 삭제(`AnalyzingRestOfMatch` 와 주석의 "위의 전체 화면 스피너" → "공용 로딩 화면(LoadingScreen)" 으로 고친다).
- [ ] **Step 3: flow** — `:122` → `<LoadingScreen preset="flow" title="선택한 해의 운세를 정리하고 있어요" />`, `:154` → `<LoadingScreen preset="flow" />`. 근처 주석의 "스피너만 보인다" → "로딩 화면만 보인다".
- [ ] **Step 4:** `git rm src/app/report/_components/AnalyzingReport.tsx "src/app/flow/[id]/_components/AnalyzingFlow.tsx"`; `grep -rn "AnalyzingReport\|AnalyzingFlow\|AnalyzingMatch\b" src` → 결과 없음(`AnalyzingRestOfMatch` 제외)
- [ ] **Step 5:** `npm run typecheck && npm test` → 통과
- [ ] **Step 6: 커밋** — `refactor(loading): 리포트·궁합·흐름 대기 화면을 LoadingScreen 으로`

---

### Task 4: CTA 클릭 직후 overlay

**Interfaces:** Consumes `LoadingScreen` (Task 2)

- [ ] **Step 1: use-unlock.ts** — `UnlockStatus` 를 `"idle" | "pending" | "opening"` 으로. `router.refresh()` 직전 `setStatus("opening");`. 주석의 "화면은 그동안 pending 을 유지해" → "화면은 그동안 opening 으로 로딩 화면을 덮어". 402/401 경로는 `pending` 그대로(overlay 없음).
- [ ] **Step 2: LockedSections.tsx** —
  - `const pending = status !== "idle";`
  - CTA_CLASS 의 `disabled:opacity-60` → `disabled:opacity-50`
  - 반환 fragment 끝에 `{status === "opening" && <LoadingScreen preset="report" variant="overlay" />}` (import 추가). refresh 가 반영돼 이 컴포넌트가 사라지면 overlay 도 사라진다.
- [ ] **Step 3: ConsultBoard.tsx** —
  - 루트 div 끝(`TicketModal` 옆)에 `{pending && <LoadingScreen preset="consult" variant="overlay" />}`
  - 성공 시 `finally` 가 `setPending(false)` 를 불러 push 완료 전에 overlay 가 꺼진다. `finally` 를 없애고 오류·402 갈래와 catch 에만 `setPending(false)` 를 둔다. 성공 갈래는 pending 유지(이동하면 언마운트).
  - 취소·시작 버튼의 `disabled:opacity-40` → `disabled:opacity-50`
- [ ] **Step 4: MatchForm.tsx** — `const [navigating, setNavigating] = useState(false);` 추가. `submit` 을:

```ts
  async function submit() {
    if (!canSubmit || !counterpart) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/matches", { /* 기존 그대로 */ });
      if (res.status === 402) {
        router.push(`/checkout?next=${encodeURIComponent("/match")}`);
        return;
      }
      const body = (await res.json()) as { matchId?: string; error?: string };
      if (!res.ok || !body.matchId) {
        setPending(false);
        setError(body.error ?? "궁합을 만들지 못했어요");
        return;
      }
      // 생성 요청은 금방 끝난다 — 느린 건 도착 페이지의 LLM 이다. 그 fallback 과 같은
      // 화면을 지금 띄워 두면 이동이 끊김 없이 이어진다.
      setNavigating(true);
      router.push(`/match/${body.matchId}`);
    } catch {
      // fetch 가 던지면(오프라인 등) 예전엔 버튼이 눌린 채 남았다.
      setPending(false);
      setError("연결이 끊겼어요. 다시 시도해 주세요");
    }
  }
```

  기존 402 주석은 유지한다. JSX 끝에 `{navigating && <LoadingScreen preset="match" variant="overlay" />}`.
- [ ] **Step 5: FlowConfirm.tsx** — `const [navigating, setNavigating] = useState(false);`, `start()` 의 `router.push(`/flow/${id}`)` 앞에 `setNavigating(true);`. 최상위 `<section>` 끝에 `{navigating && <LoadingScreen preset="flow" variant="overlay" />}`. PayModal 버튼 `disabled:opacity-60` → `disabled:opacity-50`. 소유한 해 바로가기(`:202`)는 DB 에 저장된 리포트라 빠르므로 건드리지 않는다.
- [ ] **Step 6:** `npm run typecheck && npm run lint` → 통과
- [ ] **Step 7: 커밋** — `feat(loading): 오래 걸리는 CTA 는 누르는 즉시 로딩 화면으로`

---

### Task 5: 전역 커서

**Files:** `src/app/globals.css`, `src/components/Button.tsx`, `src/app/flow/_components/SituationSheet.tsx`, `src/app/login/_components/SocialLoginButton.tsx`

- [ ] **Step 1: globals.css** 끝에:

```css
/* Tailwind v4 는 버튼 커서를 기본값으로 둔다. 버튼마다 cursor-pointer 를 붙이면
   다음 버튼에서 또 빠진다 — 여기서 한 번에 막는다. base 레이어라 컴포넌트가
   cursor-* 유틸리티로 덮어쓸 수 있다. */
@layer base {
  button:not(:disabled),
  [role="button"]:not([aria-disabled="true"]),
  summary,
  label[for] {
    cursor: pointer;
  }
  button:disabled {
    cursor: not-allowed;
  }
}
```

- [ ] **Step 2:** `Button.tsx` base 에서 `disabled:cursor-default cursor-pointer` 제거(전역 규칙과 겹치고 disabled 는 not-allowed 로 통일). `SituationSheet.tsx` 의 `"cursor-default bg-slate-300"` → `"bg-slate-300"`. `SocialLoginButton.tsx` 의 `cursor-default` 삭제.
- [ ] **Step 3:** `grep -rn "cursor-default" src` → 의도된 것만 남았는지 확인(남은 게 있으면 그 자리 주석/맥락을 보고 판단)
- [ ] **Step 4: 커밋** — `fix(ui): 버튼 커서를 전역 규칙으로 pointer 로`

---

### Task 6: 검증

- [ ] `npm run typecheck && npm run lint && npm test` → 모두 통과
- [ ] dev 서버에서:
  - `/report?profile=…` 첫 진입 → 단계형 로딩, 완료 후 본문
  - 잠긴 리포트 "이용권 1장으로 전체 보기" → 즉시 overlay, 완료 후 사라짐
  - `/match` 궁합 보기 → overlay → `/match/[id]` fallback 이 진행률을 이어받음
  - `/flow` 리포트 만들기 → 같은 흐름
  - `/consult` 시작하기 → overlay → 대화방
  - 아무 버튼 hover → pointer, 비활성 → not-allowed
  - 모바일 폭(375px)에서 가로 스크롤 없음
