# 사주 계산·해석 API 설계

날짜: 2026-07-10
브랜치: feat/landing-and-funnel

## 1. 목적

이름·생년월일·시간·성별을 받아 **만세력(원국)을 계산**하고, 해당 원국에 대한
**해석 리포트를 반환**하는 단일 API를 만든다. 해석은 원국 단위로 DB에 캐시하며,
캐시에 있으면 그대로 쓰고, 없으면 LLM으로 생성해 저장한 뒤 반환한다.

### 배경 / 현재 상태

- `src/lib/saju-core/`에 계산 엔진이 이미 존재한다. `analyze(BirthInput)`가
  원국(4기둥)·오행 분포·십성·신강/신약·용신·대운을 **결정적으로** 계산한다.
  → **만세력 계산 자체는 코드로 완결되어 있다.**
- 따라서 이 API에서 LLM이 담당하는 부분은 엔진이 못 만드는 **사람이 읽는 해석**이다.
- `src/lib/db.ts`에 Neon serverless SQL 클라이언트(`sql`)가 준비되어 있다.
- 아직 API 라우트는 없다(랜딩 페이지 앱만 존재).

### PRD와의 관계 / 의도적 편차

PRD는 "GPT가 직접 해석 생성하지 않음(룰 기반 우선, AI는 Phase 6)"이라고 명시하나,
이 API는 **LLM-first**로 간다. 단, LLM 공급자는 아직 미정이므로 생성부를
인터페이스로 추상화하고, 지금은 동작하는 stub 생성기로 파이프라인을 완결한다.

## 2. 결정 사항 (브레인스토밍 합의)

- **LLM 출력**: 구조화된 해석 JSON (섹션별). 텍스트 통짜가 아니라 프론트 렌더링에
  유리한 구조.
- **캐시 키**: 4기둥(원국 8글자) + 성별. 시주가 없으면 8글자가 달라져 자연히 다른
  키가 되고, 성별로 대운·해석 분기까지 반영된다.
- **LLM 공급자**: 미정. 생성부를 `InterpretationGenerator` 인터페이스로 추상화하고
  현재는 stub 구현으로 출시. 실제 LLM은 모듈 하나 교체로 붙인다.
- **해석 범위**: 무료 범위 우선(일간 성향·강점·약점·인간관계). 스키마는 유료 섹션
  확장이 가능하도록 설계.
- **파일 배치**: 라우트 종속 관심사는 라우트 폴더 아래 co-location(`_lib/`).
  공유 엔진 `saju-core`는 `src/lib/`에 유지.

## 3. 전체 흐름

```
POST /api/saju
  body: { name, gender, calendar, year, month, day, hour?, minute?, isLeapMonth?, longitude?, applyTimeCorrection? }
   │
   ├─ 1. 입력 검증 → BirthInput 매핑
   ├─ 2. analyze(input)          → SajuAnalysis  (엔진, 결정적 계산 — 항상 실행)
   ├─ 3. chartKey(chart, gender) → "갑자|병인|정묘|경오|male"   (시주 없으면 "…|∅|male")
   ├─ 4. DB 조회: SELECT interpretation FROM saju_interpretations WHERE chart_key = $1
   │        ├─ HIT  → { analysis, interpretation, cached: true }
   │        └─ MISS → interpretation = generator.generate(analysis)   // 현재는 stub
   │                   INSERT ... ON CONFLICT (chart_key) DO NOTHING
   │                   → { analysis, interpretation, cached: false }
```

핵심:
- `analyze()`(계산)는 결정적이고 저렴하므로 **항상 실행하고 캐시하지 않는다.**
  캐시는 **LLM 해석 결과에만** 적용한다.
- `name`은 검증만 하고 해석에는 반영하지 않는다. 해석은 원국 기준으로 캐시되므로
  이름으로 개인화한 문구는 캐시에 담을 수 없다. 응답에 echo만 하고, 개인화가
  필요하면 별도 설계로 다룬다.

## 4. 모듈 구성 (co-location)

```
src/app/api/saju/
  route.ts          # POST 핸들러: 검증 → analyze → 캐시 조회/생성 → 응답
  _lib/             # 이 라우트 전용 (co-location, 라우팅 제외)
    input.ts        # 요청 body → BirthInput 검증·매핑
    key.ts          # chartKey(chart, gender) 결정적 키
    store.ts        # getCached / putCached  (src/lib/db.ts의 sql 사용)
    generate.ts     # InterpretationGenerator 인터페이스 + StubGenerator
    types.ts        # Interpretation 구조 타입, API 요청/응답 타입
```

- `saju-core`는 공유 엔진이라 `src/lib/`에 유지(여러 라우트가 재활용).
- 나머지는 아직 이 라우트만 쓰므로 co-location. 두 번째 소비자가 생기면 그때
  `src/lib/`로 승격(YAGNI).
- 각 관심사는 독립 모듈이라 개별 테스트가 가능하고, LLM 교체는 `generate.ts`
  하나만 바뀐다.
- Next 16 route handler 규약(파일명·시그니처·runtime 등)은 구현 시
  `node_modules/next/dist/docs/`에서 재확인한다.

## 5. DB 스키마

마이그레이션 도구가 아직 없으므로(Drizzle 미설치) raw SQL 마이그레이션 파일 +
npm 스크립트로 처리한다.

```
migrations/0001_saju_interpretations.sql
scripts/migrate.ts                          # migrations/*.sql 순서대로 실행
package.json → "db:migrate": "tsx scripts/migrate.ts"
```

테이블:

```sql
CREATE TABLE saju_interpretations (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chart_key       text NOT NULL UNIQUE,        -- "갑자|병인|정묘|경오|male"
  gender          text NOT NULL,
  pillars         jsonb NOT NULL,              -- {year,month,day,hour} 간지 (디버깅/분석용)
  interpretation  jsonb NOT NULL,              -- 구조화 해석 (섹션 6)
  model           text,                        -- 생성 모델/버전 (stub이면 'stub')
  schema_version  int NOT NULL DEFAULT 1,      -- 해석 스키마 버전
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

- `chart_key` UNIQUE → 캐시 조회 및 멱등 삽입(`ON CONFLICT DO NOTHING`)의 근거.
- `analyze()` 계산 결과는 저장하지 않는다(재계산 저렴). 저장은 LLM 해석만.
  `pillars`는 사람이 원국을 알아보기 위한 참고용.
- `schema_version` / `model` → 나중에 프롬프트·스키마를 바꿔 재생성할 때 무효화 기준.

## 6. 해석 JSON & LLM 어댑터

**타입 (무료 범위, 유료 확장 여지):**

```ts
interface Interpretation {
  ilgan: { title: string; body: string };           // 일간 성향
  strengths: string[];                               // 강점
  weaknesses: string[];                              // 약점
  relationships: { title: string; body: string };    // 인간관계 특징
  // 유료(나중): personality / career / wealth / love / marriage / yongsin / daeun ...
}
```

**어댑터 인터페이스:**

```ts
interface InterpretationGenerator {
  generate(analysis: SajuAnalysis): Promise<Interpretation>;
}
```

- **현재**: `StubGenerator` — `analysis`(오행/십성/신강신약/용신)에서 결정적
  placeholder 문장을 만든다. 파이프라인이 끝까지 동작하고 테스트가 가능하다.
  저장 시 `model = 'stub'`.
- **나중**: `ClaudeGenerator` 등 — 같은 인터페이스를 구현하고 `generate.ts`만
  교체. 실제 LLM을 붙일 때 tool-use / structured output으로 위 스키마를 강제한다.

## 7. 에러 처리

| 상황 | 응답 |
|---|---|
| 잘못된 입력(필수 누락, 범위 밖 날짜/성별) | `400` + 메시지 |
| 엔진 계산 실패(알 수 없는 간지 등) | `422` |
| 해석 생성 실패(LLM 오류) | `502`, **캐시하지 않음** |
| DB 오류 | `500` |
| 동일 원국 동시 miss 2건 | 둘 다 생성 → `ON CONFLICT DO NOTHING`(선착순 저장), 나머지 무시. MVP 허용. 이중 생성 비용은 나중에 락/큐로 최적화 |

## 8. 테스트 (vitest)

- `key.ts`: 같은 원국+성별 → 동일 키 / 시주 유무·성별이 다르면 키가 다름.
- `input.ts`: 유효·무효 입력 검증(필수 누락, 잘못된 성별/달력/날짜 범위).
- `generate.ts`: StubGenerator가 스키마에 맞는 `Interpretation`을 반환.
- `store.ts`: getCached / putCached 라운드트립(테스트 DB 또는 `sql` 모킹).
- `route.ts` 통합: store·generator를 주입해서
  - 캐시 HIT 경로 → generator가 호출되지 않음
  - 캐시 MISS 경로 → generator 호출 + INSERT 발생

## 9. 스코프 밖 (나중)

- 실제 LLM 연동(공급자 결정 후).
- 유료 리포트 섹션.
- 이름 기반 개인화.
- 사용자·birth_profiles 저장(이 API는 원국→해석 캐시만 다룸, 유저 무관).
- 동시 miss 이중 생성 방지 락.
