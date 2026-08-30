# 관계 지도 궁합 설명 — 별명 15칸 × 내 오행 5칸

2026-08-30 · 상태: 설계 확정 대기

## 목표

관계 지도 상세 시트(PersonSheet)의 궁합 설명을 바꾼다:

1. **구분** — 지금은 설명이 사실상 7문장(구역 5 + 六合/沖 2)뿐이라 "비타민"과 "쓴약"이
   같은 본문을 공유한다. 별명 15칸이 각각 다른 설명을 갖게 한다.
2. **내 사주 반영** — 내 일간 오행(5)에 따라 상대 구역의 오행이 정해진다는 사실을
   문장에 싣는다. "물이 나무를 키우듯 …" 처럼 내 지도에서만 성립하는 문장이 된다.
3. **정성** — 한두 문장이 아니라 3~4문장 한 단락. 40vh 시트 안에 스크롤 없이 들어간다.

## 현재 상태

- `PersonSheet.tsx` 의 지역 상수 `ROLE_NOTE`(구역별 1문장) + `roles.ts` 의
  `FEATURE_NOTE`(六合/沖 1문장)를 이어 붙인 것이 설명의 전부다.
- 별명(`DISPLAY_TITLES`) 15칸은 전부 다른데 본문은 5+2개다.
- 중심(나)의 정보는 서버에서 세우기만 하고(`centerOf`) 클라이언트로 내려보내지 않는다
  — `[share]/page.tsx` 주석: "MapShell 이 이 값을 받을 일이 없다". 이번에 바뀐다.

## 결정 사항 (사용자 확인 완료)

- 구분 단위: **별명 15칸 + 내 일간 오행 반영** (사람별 LLM 생성은 하지 않는다)
- 분량: **3~4문장 한 단락** (소제목 블록 구조는 하지 않는다)
- 구조: **두 층 조합** — 오행 다리 문장 25칸 + 별명 단락 15칸. 75칸 풀 테이블과
  15칸+치환 템플릿은 기각 (전자는 유지보수 부담, 후자는 조사 처리가 기계적).

## 설계

### 1. 새 데이터 모듈 `src/app/map/_data/relation-notes.ts`

두 표와 한 함수. 전부 순수 데이터/함수 — three 도 DB 도 import 하지 않는다.

**표 1 — 오행 다리 문장 (25칸)**

```ts
export const ELEMENT_BRIDGE: Record<Element, Record<RelationRole, string>>
```

내 일간 오행 × 구역. 각 칸은 **내 오행과 상대 구역 오행을 자연어 이름으로 직접
부르는 한 문장**이다. 치환 템플릿이 아니라 25문장을 전부 손으로 쓴다.

상대 오행은 관계 엔진(`relationKind`)과 같은 규칙으로 정해진다 — 한 지도 안에서
같은 구역 사람들은 전부 같은 일간 오행이다:

| 구역 | 규칙 | 내가 목이면 상대는 |
|---|---|---|
| fill (생아) | 상대가 나를 생 | 수 |
| beside (비아) | 같은 오행 | 목 |
| express (아생) | 내가 상대를 생 | 화 |
| move (아극) | 내가 상대를 극 | 토 |
| refine (극아) | 상대가 나를 극 | 금 |

문장 안에서 오행은 한자어(목·화·토·금·수)가 아니라 자연어(나무·불·흙·쇠·물)로
부른다. 예 (목 × fill):

> 물이 나무를 키우듯, 이 사람의 기운은 당신 쪽으로 흘러듭니다.

**표 2 — 별명 단락 (15칸)**

```ts
export const NICKNAME_NOTE: Record<RelationRole, Record<Feature, string>>
```

구역 × 소구역(기본·六合·沖). 각 칸은 `DISPLAY_TITLES` 의 별명(보조배터리·비타민·
쓴약…)이 왜 그 별명인지 푸는 **2~3문장**이다. 예 (fill × chung, "쓴약"):

> 당장은 쓰게 느껴져도 지나고 보면 필요했던 채움이 남는 사이입니다. 편하지만은
> 않은 방식으로, 이 사람은 당신의 빈 곳을 짚어 채워 줍니다.

**함수**

```ts
export function relationNote(myElement: Element, role: RelationRole, feature: Feature): string
```

`ELEMENT_BRIDGE[myElement][role] + " " + NICKNAME_NOTE[role][feature]`. 화면은 이
문자열 하나를 한 `<p>` 로 렌더한다.

두 표 모두 `as const satisfies` 로 잠근다 — 오행이든 별명이든 칸을 하나라도
빠뜨리면 컴파일되지 않는다 (`relation-copy.ts` 와 같은 방식).

### 2. 카피 원칙 (40칸 전부에 적용)

- **판단하지 않는다.** 좋은 관계/나쁜 관계/피해야 할 사람 같은 등급을 말하지
  않는다. 지도의 선·알파가 관계의 강약을 말하지 않는 것과 같은 원칙이다
  (connections.ts 의 "선이 관계의 좋고 나쁨을 말하기 시작한다" 금지선의 카피판).
- **六合/沖 은 같은 무게로 쓴다.** 沖 별명(쓴약·라이벌·버튼·불쏘시개·회초리)은
  "나쁨"이 아니라 "쓸모 있는 마찰"로 쓴다. 기존 FEATURE_NOTE 원칙의 계승.
- **별명을 단락이 받는다.** 별명 단어(또는 그 심상)가 단락 안에 자연스럽게
  등장해, 제목(별명)과 본문이 한 몸으로 읽히게 한다.
- **문체는 기존 시트와 같은 "~입니다" 체.**
- 결혼·재물·성공 예측을 하지 않는다 (match 리포트의 caution 과 같은 결).

### 3. 배선 — 내 오행을 시트까지

- `MapCenter` 에 `element: Element` 추가. `centerOf` 가 `STEMS[day.stem].element`
  로 채운다.
- `[share]/page.tsx`: center 를 관문으로만 쓴다는 주석을 갱신하고,
  `centerElement={center.element}` 를 MapShell 에 넘긴다.
- `MapShell` props 에 `centerElement: Element` 추가, PersonSheet 로 그대로 전달.
- 프라이버시: 오행은 5분류로, 이미 노출 중인 각 사람의 일주(60분류)보다 훨씬
  거칠다. 링크 공유가 전제인 화면이라 문제 없다고 판단.

### 4. PersonSheet 변경

- 지역 상수 `ROLE_NOTE` 삭제.
- `FEATURE_NOTE` 렌더 블록 삭제 (별명 단락에 흡수).
- 그 자리에 `<p>{relationNote(centerElement, shown.role, shown.feature)}</p>` 하나.
- "일주가 통째로 같아요"(sameDayPillar) 줄은 유지 — 배치로는 말할 수 없는 사실이라는
  기존 역할 그대로.
- 모바일 40vh 시트에서 3~4문장이 넘치는지 확인하고, 넘치면 내용 영역에
  `overflow-y-auto` 를 안전판으로 둔다 (기본은 스크롤 없이 들어가는 분량으로 카피를
  조절한다).

### 5. roles.ts 정리

- `FEATURE_NOTE` 삭제 — 사용처가 PersonSheet 렌더와 자체 테스트뿐이다.
  `roles.test.ts` 의 해당 테스트(길이 균형·none 빈 문자열)도 함께 삭제한다.
  길이 균형 원칙은 새 모듈의 테스트로 옮겨 간다.
- `DISPLAY_TITLES`·`FEATURE_LABELS`·`ROLE_LABELS` 등 나머지는 그대로.

### 6. 테스트 (`relation-notes.test.ts`)

- **40칸 전부 비어 있지 않다** (타입이 칸의 존재를, 테스트가 내용의 존재를 잠근다).
- **오행 정합**: `ELEMENT_BRIDGE[my][role]` 문장이 그 칸의 상대 오행 자연어
  이름(나무·불·흙·쇠·물)을 포함한다. 상대 오행은 saju-core 의
  `generatedBy`/`elementGenerates`/`elementControls`/`controlledBy` 로 계산한다 —
  25칸이 관계 엔진과 어긋난 채 배포될 수 없다.
- **六合/沖 무게 균형**: 각 구역에서 yukhap 칸과 chung 칸 중 짧은 쪽이 긴 쪽
  길이의 70% 이상 (기존 ±3자 규칙의 단락판 — 글자 수를 정확히 맞추는 것은
  단락에선 과하다).
- `relationNote` 가 두 층을 공백 하나로 잇는다.

## 하지 않는 것

- 음양(양간/음간, 정인/편인 급) 구분 — 오행 5분류에서 멈춘다.
- 사람별(일주 조합별) 동적 생성 — 유료 궁합 리포트(match)의 영역.
- RegionLabels·PeopleList 등 다른 화면의 문구 변경.
- match 리포트 쪽 `relation-copy.ts` 는 건드리지 않는다 (이름이 비슷하지만 다른
  화면의 다른 층이다).

## 완료 기준

- 지도에서 아무 두 사람을 골라도, 별명이 다르면 설명 본문이 다르다.
- 같은 별명이라도 지도 주인의 일간 오행이 다르면 첫 문장이 다르다.
- 시트 설명이 3~4문장 한 단락이고, 모바일 40vh 에서 스크롤 없이 읽힌다.
- `npx vitest run` 통과, 타입 체크 통과.
