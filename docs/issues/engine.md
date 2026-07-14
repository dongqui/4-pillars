# Phase 1 - 사주 계산 엔진

> 상태: ✅ 완료 / 🚧 진행 중 / ⬜ 대기

## ✅ ISSUE-001. 사주 원국 계산 엔진 (F002)

- 생년월일시 → 년주/월주/일주/시주 계산
- 절기 기준 월주 처리 (`saju-core/astro/solar-term`)
- 구현: `src/lib/saju-core/chart.ts`

## ✅ ISSUE-002. 오행 분석 (F003)

- 목/화/토/금/수 분포 및 비율 계산
- 구현: `src/lib/saju-core/elements.ts`

## ✅ ISSUE-003. 십성 분석 (F004)

- 비견~정인 10종 십성 도출
- 구현: `src/lib/saju-core/ten-gods.ts`

## ✅ ISSUE-004. 신강/신약·용신·대운 계산

- 일간 강약 판정, 용신 분석, 대운 산출
- 구현: `src/lib/saju-core/strength.ts`, `yongsin.ts`, `luck.ts`

## ⬜ ISSUE-005. 음력 입력 지원 (F001 일부)

- 음력 → 양력 변환 후 원국 계산 (`@fullstackfamily/manseryeok` 활용 검토)
- 퍼널의 양력/음력 선택값이 실제 계산에 반영되는지 검증
