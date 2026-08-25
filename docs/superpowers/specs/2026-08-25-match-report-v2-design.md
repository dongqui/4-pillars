# 궁합 리포트 v2 — 5섹션에서 10섹션으로

날짜: 2026-08-25
브랜치: `claude/saju-report-v2-redesign-69347d`
기획 원문: `docs/match-report-v2-plan.md` (이하 §번호는 그 문서의 장 번호다)

## 문제

지금 궁합은 다섯 섹션(총평·케미·서로에게·흔들리는 순간·다가가는 법)이다. 내용은
충분하지만 **관계가 시간 속에서 굴러가는 모습**이 빠져 있다. 어떻게 가까워지는지,
서로에게 어떤 변화를 남기는지, 갈등이 시작된 다음 무슨 일이 벌어지는지가 없다.

두 번째 문제는 관계 유형이다. 열 종류(썸·연인·배우자·부모-자녀·형제/자매·친구·
직장 상하·사업 파트너·선생-제자·기타)를 지원하는데, 유형이 프롬프트에 미치는 영향은
`relation-types.ts` 의 `lens` **한 문장**이 전부다. 화면 제목은 `MatchBody.tsx` 에
하드코딩돼 있어 직장 상하 궁합도 "다가가는 법"을 읽는다.

## 결정

화면 섹션을 10개로 늘리되, **LLM 콜은 7개로 묶는다.** 그리고 관계 유형별 제목과
관점을 정적 테이블로 세운다.

세 결정 모두 "프롬프트로 부탁하는 대신 구조로 강제한다"는 한 방향이다.

---

## 1. 콜 7개가 화면 10개를 만든다

섹션 하나에 콜 하나가 자연스러워 보이지만 그러면 두 가지를 잃는다. 원가가 2배가 되고,
§15 「특히 혼동하면 안 되는 영역」이 지목한 세 쌍의 중복 방지가 프롬프트 문구에만
기대게 된다.

그래서 **§15 가 짝지어 놓은 쌍을 그대로 콜 경계로 쓴다.** 한 응답 안에서 두 섹션이
같이 쓰이면 모델이 `toMe` 를 쓴 뒤 같은 호흡에 `changeInMe` 를 쓴다. "같은 말을
반복하지 마라"가 부탁이 아니라 한눈에 보이는 구조가 된다.

이미 `chemistry` 가 정확히 이 이유로 pull/friction 을 한 콜에 묶어 두었다
(`registry.ts`: "따로 뽑으면 두 편의 글이 된다").

| 콜 키 (= 저장 키 = 스키마 단위) | 화면 섹션 | version |
|---|---|---|
| `verdict` | 01 총평 | **2** |
| `chemistry` | 02 케미 | **2** |
| `closeness` | 03 관계가 가까워지는 방식 | 1 |
| `bond` | 04 서로에게 + 05 함께할수록 달라지는 것 | 1 |
| `together` | 06 함께 있을 때 + 07 관계가 이어질 때 | 1 |
| `conflict` | 08 흔들리는 순간 + 09 갈등과 회복 | 1 |
| `advice` | 10 잘 지내는 법 | 1 |

원가는 궁합 1건당 현재의 1.4배(5콜 → 7콜)다. 섹션당 1콜이었다면 2배였다.

### 대가 (받아들이기로 한 것)

**부분 실패 단위가 굵어진다.** `bond` 한 콜이 죽으면 04·05 가 함께 사라진다. 지금은
섹션 하나가 죽으면 하나만 빈다. 묶음의 값이 곧 이 위험이다.

**`maxDuration = 60` 이 빠듯해질 수 있다.** `bond`·`together`·`conflict` 는 두 섹션
분량을 한 응답에 뱉으므로 개별 콜이 느려진다. 병렬이라 벽시계는 합이 아니라 최댓값이지만,
구현 중 실측해 필요하면 올린다.

---

## 2. 스키마

`registry.ts` 의 `MATCH_SECTIONS` 를 7개 키로 다시 쓴다. 잎 스키마는 기존
`primitives.ts` 의 `TitledText` · `LabeledText` 를 그대로 쓴다 — 새 잎을 만들지 않는다.

```
verdict    { headline, summary }                                  // 모양 그대로
chemistry  { pull: TitledText[2..4], friction: TitledText[2..4] } // 모양 그대로
closeness  LabeledText[2..5]
bond       { toMe, toYou, changeInMe, changeInYou, changeBetween }
together   { now: LabeledText[2..5], later: LabeledText[2..5] }
conflict   { triggers: LabeledText[2..3], onset, escalation, recovery, blindSpot }
advice     { items: TitledText[2..4], first }
```

### 스펙이 스키마가 되는 지점

- **§15 의 세 쌍**이 `bond`·`together`·`conflict` 한 스키마 안의 형제 필드가 된다.
- **§13 「실천 1/2/3 으로 표시하지 않는다」** → `advice.items` 가 `string[]` 에서
  `TitledText[]` 로 바뀐다. 조언 자체가 제목이 되는 것을 스키마가 강제한다.
  이것이 `bridge` 키를 살릴 수 없는 직접적인 이유다.
- **§13 「가장 먼저 해볼 것」** → `advice.first`. 지금 `bridge.tip` 과 같은 자리라
  `NoteCard tip` 렌더를 그대로 쓴다.
- **§12 의 네 소제목**(갈등이 시작되면 / 감정이 커지면 / 다시 회복할 때 /
  놓치기 쉬운 부분) → `conflict` 의 `onset`·`escalation`·`recovery`·`blindSpot`.
- **§8 의 세 방향**(내가 받는 변화 / 상대가 받는 변화 / 둘 사이에 생기는 변화) →
  `bond` 의 `changeInMe`·`changeInYou`·`changeBetween`.

### 스펙을 그대로 따르지 않는 한 곳

§5 는 케미를 "3~4개"라고 하지만 `min` 을 3으로 올리지 않고 `min(2).max(4)` 를 유지한다.
모델이 2개만 뱉으면 `parseMatchSectionContent` 가 통째로 버려 케미 섹션이 **아예
사라진다.** 검증은 "쓸 수 없는 것"만 막고 "덜 채운 것"은 통과시킨다. 3~4개 요구는
프롬프트가 한다.

같은 이유로 새 배열 스키마들의 `min` 도 스펙 권장치보다 하나 낮게 잡는다.

---

## 3. 관계 유형별 카피 테이블

`src/lib/matches/relation-copy.ts` — `relation-types.ts` 바로 옆. 유형별 문구를
늘리는 유일한 자리다.

```ts
/** 유형별로 갈리는 자리. 콜 키가 아니라 **화면 섹션** 단위다 —
 *  together 한 콜이 06·07 두 화면을 만들고 둘의 제목이 따로 갈린다. */
export type VariantSectionKey =
  | "closeness"    // 03
  | "presence"     // 06
  | "continuity"   // 07
  | "recovery"     // 09
  | "advice";      // 10

export interface RelationCopy {
  category: string;            // SectionHeading 의 작은 라벨
  title: string;               // SectionHeading 의 큰 제목
  angles: readonly string[];   // 프롬프트에 실리는 관점 불릿
  /**
   * 이 관계·이 섹션에서만 걸리는 금지선. 없으면 생략한다.
   *
   * `angles` 와 갈라 두는 이유: 하나로 합치면 그 축이 "볼 장면"과 "쓰면 안 되는 것"
   * 두 뜻을 겸하게 되고, 금지선이 관점 목록에 섞여 하나의 소제목처럼 렌더될 위험이 생긴다.
   * 원문의 금지선은 네 자리다 — 썸 07(결혼·동거 전제 금지), 배우자 07(결혼운 판단 금지),
   * 사업 파트너 07(성공 예측 금지), 직장 상하 07(권한 차이 무시 금지).
   */
  caution?: string;
}

export const RELATION_COPY = {
  spouse: {
    closeness: {
      category: "마음이 가까워지는 순간",
      title: "익숙한 사이에서도 다시 연결되는 방식",
      angles: [
        "서로에게 마음을 여는 방식",
        "애정과 신뢰를 확인하는 순간",
        "일상 속에서 다시 가까워지는 계기",
        "거리감이 생겼을 때 다시 연결되는 방식",
      ],
    },
    // presence · continuity · recovery · advice …
  },
  // 나머지 아홉 유형 …
} as const satisfies Record<RelationTypeId, Record<VariantSectionKey, RelationCopy>>;
```

### `satisfies` 가 두 축을 동시에 잡는다

관계 유형을 하나 늘리면 그 유형의 다섯 칸이 없다고 컴파일이 깨지고,
`VariantSectionKey` 를 하나 늘리면 열 유형 전부가 깨진다. 어느 쪽도 빈 칸인 채로
배포될 수 없다. `RELATION_TYPES` 가 이미 쓰는 방식과 같다.

### `category` / `title` 이 §6·§10 의 형식과 1:1이다

기획 원문이

```
### 마음이 가까워지는 순간
**익숙한 사이에서도 다시 연결되는 방식**
```

라고 쓴 것이 그대로 `category` + `title` 이고, 기존 `SectionHeading(no, category, title)`
이 이미 그 두 층을 렌더한다. 새 컴포넌트가 필요 없다.

### `angles` 는 §6·§9·§10·§12·§13 의 불릿 목록

배우자 07 의 「생활의 리듬 / 역할을 나누는 방식 / 돈과 현실 / 각자의 공간 /
오래 함께할수록 중요한 것」이 `angles` 로 들어가고, 모델이 그것을 `LabeledText` 의
`label` 로 되돌려 준다. 유형마다 소제목 개수가 달라도 **스키마는 하나로 균일하다.**

### 유형이 없을 때

`relation.type === null` 이면 `custom`(기타) 카피를 쓴다. 둘 다 "관계 맥락을 임의로
추정하지 않는 중립 서술"이라 카피가 같아도 되고, 축을 하나 더 만들면 그 축만 갱신을
놓친다. 두 경우의 차이는 기존 `relationLens` 가 이미 갈라 준다.

---

## 4. 프롬프트 조립

`registry.ts` 의 각 spec 에 `variants: readonly VariantSectionKey[]` 한 줄을 단다.

| 콜 키 | variants | 근거 |
|---|---|---|
| `verdict` · `chemistry` · `bond` | `[]` | §17 「영향을 적게/어느 정도 받는 섹션」 — 기존 `lens` 한 줄로 충분 |
| `closeness` | `["closeness"]` | |
| `together` | `["presence", "continuity"]` | 한 콜이 두 화면을 만든다 |
| `conflict` | `["recovery"]` | 08은 §17 「어느 정도」, 09는 「크게」 |
| `advice` | `["advice"]` | |

`buildMatchSectionRequest` 가 `[사실]` 다음, `[요청]` 앞에 블록을 끼운다:

```
[이 관계에서 볼 장면 · 함께 있을 때]
- 대화의 리듬
- 애정이나 관심을 표현하는 방식
...
```

`variants` 가 빈 배열이면 블록 자체를 넣지 않는다.

### 시스템 프롬프트

유형과 무관한 공통 규칙이라 테이블이 아니라 `MATCH_SYSTEM_PROMPT` 자리다. 세 가지를
덧붙인다:

- **§16** — 연애 관계가 아니면 연애적 감정·질투·소유욕·애정 표현을 전제하지 않는다.
  가족·업무·사업·선생-제자 관계에도 그 관계에 없는 상황을 만들지 않는다.
- **§18** — 금지 문구(천생연분, 최고/최악의 궁합, 운명적인 상대, 반드시 헤어진다,
  평생 함께한다, 결혼해야 한다/하지 말아야 한다, 사업하면 성공한다, 함께하면 돈을 번다).
  지금은 "지속·이별·결혼을 예언하지 마라" 한 줄뿐이다.
- **§9** — 미래를 단정하지 않는 어미(`~하기 쉬워요`, `~하는 방향으로 작용해요`).
  `반드시 ~하게 됩니다` / `결국 ~하게 됩니다` 를 금지한다.

---

## 5. 화면

### 제목 결정을 순수 모듈로 뺀다

섹션 제목이 이제 두 출처에서 온다 — 유형 무관 다섯(01·02·04·05·08)은 고정, 유형별
다섯은 `RELATION_COPY`. 이걸 JSX 안에서 섞으면 번호와 제목이 조건문에 흩어진다.

```ts
// src/app/match/[id]/_lib/to-section-headings.ts

/** 화면 섹션 10개. 콜 키(7개)와 다른 축이다 — bond 한 콜이 eachSide·change 두 화면을 만든다. */
type ScreenSectionKey =
  | "verdict"    // 01   고정
  | "chemistry"  // 02   고정
  | "closeness"  // 03   유형별
  | "eachSide"   // 04   고정
  | "change"     // 05   고정
  | "presence"   // 06   유형별
  | "continuity" // 07   유형별
  | "triggers"   // 08   고정
  | "recovery"   // 09   유형별
  | "advice";    // 10   유형별

matchSectionHeadings(relation: RelationInput): Record<ScreenSectionKey, {
  no: string; category: string; title: string;
}>
```

유형별 다섯 개가 `VariantSectionKey` 와 같은 이름인 것은 우연이 아니다 —
`VariantSectionKey` 는 `ScreenSectionKey` 중 유형별로 갈리는 것만 고른 부분집합이고,
`VariantSectionKey extends ScreenSectionKey` 로 그 관계를 타입이 붙들게 한다.

번호를 매기는 자리가 여기 하나가 되고, "배우자의 03과 직장 상하의 03은 다른 제목"이
JSX 없이 테스트되는 순수 함수가 된다. 이 디렉터리의 `to-match-view.ts` 와 같은 모양이다.

### `MatchBody`

`{ interpretation, relation }` 을 받는다 (`page.tsx` 에 `match.relation` 이 이미 있다).
카드 컴포넌트는 전부 기존 것(`SectionHeading`·`CardGrid`·`InfoCard`·`NoteCard`)을 쓰고
새로 만들지 않는다. 반복되는 "제목 + 카드 그리드"는 파일 안 로컬 헬퍼로 접는다.

부분 실패 처리는 지금 그대로 — 자기 키가 없으면 섹션을 건너뛴다. `bond` 가 없으면
04·05 가 함께 빠진다.

---

## 6. 데이터 · 마이그레이션

`match_sections` 스키마는 그대로다. `verdict`·`chemistry` 는 version 2 라
`decodeMatchSections` 가 옛 행을 `missing` 으로 잡고 `putMatchSections` 의
조건부 `DO UPDATE` 가 덮어쓴다 — 손댈 것이 없다.

사라진 키만 치운다:

```sql
-- migrations/0033_match_sections_v2_cleanup.sql
DELETE FROM match_sections WHERE section_key IN ('eachSide', 'moments', 'bridge');
```

`isMatchSectionKey` 가 모르는 키를 이미 걸러 주므로 이 DELETE 가 없어도 화면은
멀쩡하다. 미아 행이 쌓이는 것을 막는 위생 조치다.

### 기존 궁합의 재생성 비용

기존 궁합을 다시 열면 일곱 콜이 전부 새로 나간다. `spendTicket` 은
`entitlements_unique` 때문에 같은 `matchId` 에 두 번 차감하지 않으므로
(`kind: "already"`), **사용자는 무료이고 LLM 원가는 우리가 부담한다.**

이것을 알고 고른 것이다. `verdict`·`chemistry` 만 살릴 수도 있었지만, 그러면 새 규칙
(§4 「뒤에서 다룰 행동 패턴을 총평에서 미리 소비하지 않는다」·유형별 관점)이 걸리지 않은
옛 총평이 새 섹션과 같은 말을 하는 겹침을 막을 수 없다. 한 리포트 안에서 두 문체가
섞이지 않는 쪽을 택했다.

---

## 7. 테스트

TDD 로 간다 — 구현 전에 쓴다.

1. **`relation-copy.test.ts`** — 50칸이 전부 채워졌고 빈 문자열이 없으며 `angles` 가
   1개 이상. *타입은 칸의 존재만 잡지 빈 문자열은 못 잡는다.*
2. **`prompt/index.test.ts`** — `together` 요청에 presence·continuity 두 블록이 다
   실린다. `verdict` 에는 관점 블록이 없다. 같은 섹션이 유형에 따라 다른 문구를 싣는다.
3. **`to-section-headings.test.ts`** — 배우자와 직장 상하가 03에서 다른 제목을 받는다.
   `type === null` 이 `custom` 카피로 물러선다. 번호가 01–10, 중복 없음.
4. **`store.test.ts` 보강** — version 1 인 옛 `verdict` 행이 `missing` 으로 잡힌다
   (재생성 경로가 실제로 열리는지).
5. **`derive.test.ts`** — 일곱 키, `matchLlmInputSchema` 가 각 키에서 유효한
   JSON Schema 를 낸다.

---

## 8. 범위 밖

**§19 의 「궁합의 근거 자세히 보기」 영역.** 원문도 "제공할 수 있다"로 열어 둔
선택지고, 지금 넣으면 명리 용어를 노출하는 새 UI 표면이 하나 더 생긴다. 필요해지면
별도 건으로 한다.

---

## 9. 일의 실제 무게

코드 변경 자체는 크지 않다. 이 작업의 대부분은 **50칸의 한국어 카피**다.
§6·§10 이 03·07 의 제목과 불릿을 거의 다 써 두었지만, 06·09·10 은 유형별 관점 목록만
있고 제목이 없어 새로 지어야 한다. 초안을 쓰되 카피는 리뷰가 필요한 물건으로 넘긴다.
