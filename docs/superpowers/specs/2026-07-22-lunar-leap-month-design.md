# ISSUE-005 — 음력 윤달 입력 지원 (F001 일부)

> 상태: 설계 승인 대기
> 작성일: 2026-07-22

## 배경

사주 계산 엔진(`saju-core/chart.ts`)과 API(`api/saju/_lib/input.ts`)는 이미
음력 입력과 윤달(閏月, `isLeapMonth`)을 지원한다.

- [chart.ts](../../../src/lib/saju-core/chart.ts): `calendar === "lunar"`이면
  `lunarToSolar(year, month, day, isLeapMonth)`로 양력 변환 후 원국 계산.
- [input.ts](../../../src/app/api/saju/_lib/input.ts): `calendar`, `isLeapMonth`
  검증·통과.

그러나 **퍼널 프런트엔드가 윤달을 캡처하지도, 전달하지도 않는다.**

- `FunnelData`에 `isLeapMonth` 필드가 없다.
- [toBirthInput.ts](../../../src/app/funnel/_lib/toBirthInput.ts)가 `isLeapMonth`를
  전달하지 않는다 → 윤달 출생자도 항상 평달로 계산된다.
- [BirthDateStep.tsx](../../../src/app/funnel/_components/steps/BirthDateStep.tsx)에
  양력/음력 토글은 있으나 윤달 UI가 없다.

양력/음력 선택값 자체는 `calendar`를 통해 계산에 반영된다(검증 완료). 남은 작업은
**윤달 선택을 퍼널에서 캡처해 끝까지 배선**하는 것이다.

## 목표

- 음력 선택 시, 해당 연·월에 실제로 윤달이 존재할 때만 "윤달" 토글을 노출한다.
- 선택된 윤달 값을 `BirthInput.isLeapMonth`로 API까지 전달한다.
- 확인(리뷰) 화면에 윤달 여부를 표시한다.

## 비목표 (YAGNI)

- 음력 날짜 유효성(음력 월별 29/30일)의 정밀 검증 — 현행 양력식 일수 클램프를 유지한다.
- 지원 범위(1930–2050) 밖 연도 처리 — 기존 입력 범위(1930~현재)를 따른다.

## 핵심 결정: 윤달 존재 여부 판별 (A안)

manseryeok에는 "이 음력 연·월에 윤달이 있나?"를 직접 묻는 API가 없다. 대신
`lunarToSolar(y, m, 1, true)`가 **윤달이 있는 월에는 양력 날짜를 반환하고, 없는
월에는 `InvalidDateError`를 던진다**(검증 완료: 2020 윤4월, 2023 윤2월, 2025 윤6월).

manseryeok 전체 번들은 304KB라 클라이언트에 넣기엔 무겁다. 따라서:

- **빌드타임(테스트)에서 manseryeok로 윤달 표를 생성**해 `saju-core`에 커밋한다.
- 런타임 조회는 순수 표 조회로, 클라이언트 번들 증가 ≈ 0.

### 데이터 구조

```ts
// src/lib/saju-core/data/leap-months.ts
// 파생 데이터 — leap-months.gen.test.ts가 manseryeok로 정확성 검증.
// 값: 해당 음력 연도의 윤달 월 번호(1~12). 윤달 없는 해는 항목 없음.
export const LEAP_MONTHS: Record<number, number> = {
  // 예시(실제 값은 생성기가 산출)
  2020: 4,
  2023: 2,
  2025: 6,
  // ...
};
```

한 음력 연도에는 윤달이 최대 1회이므로 `year → month` 맵으로 충분하다.
1930–2050 범위에서 항목은 약 45개 내외(19년 7윤법)로 매우 작다.

### 헬퍼

```ts
// src/lib/saju-core/leap.ts
export function getLeapMonth(year: number): number | null {
  return LEAP_MONTHS[year] ?? null;
}
export function hasLeapMonth(year: number, month: number): boolean {
  return LEAP_MONTHS[year] === month;
}
```

`saju-core/index.ts`에서 `hasLeapMonth`, `getLeapMonth`를 export한다.

## 변경 범위

### 1. `saju-core` — 윤달 표 + 헬퍼

- `src/lib/saju-core/data/leap-months.ts`: `LEAP_MONTHS` 표(생성기 산출값 커밋).
- `src/lib/saju-core/leap.ts`: `hasLeapMonth`, `getLeapMonth`.
- `src/lib/saju-core/index.ts`: 재-export.
- 생성 방식: `leap-months.gen.test.ts`가 1930–2050 각 연·월에 대해
  `lunarToSolar(y, m, 1, true)`를 호출, `InvalidDateError`가 아닌 월을 수집해
  `LEAP_MONTHS`와 **일치하는지 검증**한다(표가 틀리면 테스트 실패).

### 2. `FunnelContext` — 상태

- `FunnelData`에 `isLeapMonth: boolean` 추가, `initialData`에서 `false`.

### 3. `BirthDateStep` — 윤달 토글

- 조건: `data.calendar === "lunar"` **그리고** `hasLeapMonth(y, m)`가 참일 때만
  "윤달" 체크박스를 날짜 입력 아래 노출.
- 바인딩: 체크 상태를 `data.isLeapMonth`에 반영.
- 리셋 규칙: 아래 상황에서 `isLeapMonth`를 `false`로 되돌린다.
  - 달력을 양력으로 전환.
  - 연/월 변경(`commit`) 후 그 월에 윤달이 없어짐.
- UI: 퍼널 전반과 일관되도록 기존 `Toggle` 컴포넌트(ReviewStep에서 사용 중)를
  재사용하고, "윤달" 라벨과 간단한 설명을 붙인다.

### 4. `toBirthInput` — 전달

```ts
isLeapMonth: data.calendar === "lunar" ? data.isLeapMonth : undefined,
```

### 5. `ReviewStep` — 표시

- 생년월일 행: 윤달이면 "음력 윤4월" 형태로 월 앞에 "윤" 표기.
  (`data.calendar === "lunar" && data.isLeapMonth`일 때만.)

## 데이터 흐름

```
BirthDateStep (음력 + 윤달 있는 월)
  └ 윤달 체크 → FunnelData.isLeapMonth = true
       └ ReviewStep: "음력 윤4월 …" 표시
            └ toBirthInput: isLeapMonth 전달
                 └ POST /api/saju → input.ts 검증
                      └ chart.ts: lunarToSolar(..., true) → 양력 변환 → 원국
```

## 에러 처리

- 윤달 없는 월에서 UI가 토글을 숨기므로 정상 흐름에서 `InvalidDateError`는 발생하지 않는다.
- 방어선: API `input.ts`는 이미 잘못된 조합을 검증한다. 표 생성 테스트가 UI 조건과
  동일 데이터 소스(manseryeok)를 검증하므로 UI 표와 계산이 어긋나지 않는다.

## 테스트

1. `leap.test.ts`: `hasLeapMonth`/`getLeapMonth` 표 조회 정확성.
2. `leap-months.gen.test.ts`: `LEAP_MONTHS`가 manseryeok 산출과 완전 일치(생성·검증).
3. `toBirthInput.test.ts`: 음력+윤달 시 `isLeapMonth: true` 전달, 양력 시 `undefined`.
4. `chart.test.ts`: 알려진 윤달 음력일(예: 2020 윤4월 1일 → 양력 2020-05-23) 원국 스냅샷.
5. (선택) `BirthDateStep` 상호작용: 윤달 없는 월 선택 시 토글 미노출/리셋.
