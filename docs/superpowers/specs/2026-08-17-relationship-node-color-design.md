# Relationship World — 사람 Node 의 사주색 재설계

> 2026-08-17 · `/lab/relationship-world` UI 스파이크

## 0. 한 줄

우주에 5개의 Field 오브젝트를 놓는 대신, **사람마다 자기 사주색을 가진 Node 로 존재하고 그 빛이 겹치면서 공간이 생긴다.**

## 1. 배경

직전 재설계는 5개 관계 역할을 성질이 다른 5개 Field(cloud / layer / rays / ribbon / crystal)로 만들었다. 그 방향을 보류한다.

역할 분담을 하나씩만 지게 바꾼다.

```
색      = 사람 자체의 사주
공간    = 나와의 관계 역할
빛/움직임 = 두 사람 사이의 관계 작용
```

기록해 둘 사실: **직전 Field 재설계는 한 번도 렌더된 적이 없다.** `extend` 가 실행되지 않아 (`72dd8db` 에서 수정) 그 브랜치가 머지된 시점부터 화면에는 에러 오버레이만 떴다. 따라서 이 문서의 방향 전환은 Field 가 못생겼다는 판단이 아니라 컨셉 변경이다 — 되돌릴 일이 생기면 git 에서 꺼내면 된다.

## 2. 삭제 범위

`_components/fields/` 디렉터리 전체를 지운다.

```
BesideLayers.tsx  ExpressRays.tsx  FieldAccents.tsx  FieldRegistry.tsx
FillVolume.tsx    MoveRibbons.tsx  RefineShards.tsx  geometry.ts
tint.ts  tint.test.ts  shaders/common.ts  shaders/materials.ts  shaders/materials.test.ts
```

이 디렉터리는 `World.tsx` 의 `FieldRegistry` import 와 렌더 한 줄에서만 참조된다. 그 두 줄과 함께 통째로 사라진다. 다른 진입점은 없다(확인함).

### 남기는 것

`_lib/layout.ts` 는 손대지 않는다. `positionFor` 가 role 마다 다른 실루엣으로 사람을 앉힌다 — beside 는 기울어진 4개 층, refine 은 격자, express 는 광선 방향, move 는 리본 곡선, fill 은 동심 껍질. Field 오브젝트가 없어져도 이 배치가 그대로 "5 Role 은 공간적 위치로 구분"을 수행한다. 오히려 Field 가 사라져야 배치가 눈에 보인다.

`layout.test.ts` 39개도 그대로 산다.

`RelationThread`, `CameraRig`, `PersonMarker`, `PersonSheet`, `Starfield`, `SelfCore`, 카메라 A/B/C 토글은 모두 유지한다.

## 3. 색 시스템 — `_data/saju-colors.ts`

### 3.1 pillarKey 파싱

`pillarKey` 는 한글 2글자다(`"갑자"`, `"신미"`). **0번째 글자가 천간, 1번째 글자가 지지다.**

이건 반드시 위치로 파싱해야 한다. `신` 은 천간 辛 이면서 지지 申 이기도 하다 — `"신미"` 의 신은 천간이고 `"무신"` 의 신은 지지다. 글자만 보고 판정하면 두 사람이 같은 색이 된다. 파서는 각 자리를 자기 목록에 대해서만 검증하고, 목록에 없으면 던진다.

```ts
const STEMS = ["갑","을","병","정","무","기","경","신","임","계"] as const;
const BRANCHES = ["자","축","인","묘","진","사","오","미","신","유","술","해"] as const;
```

### 3.2 Outer glow — 일간(10 Family)

오행이 hue 를, 음양이 채도·명도를 정한다. 같은 오행 형제(甲/乙)는 hue 가 **완전히 같고** 밝기만 다르다 — 그래서 계열로 읽힌다.

| 천간 | 오행 | 음양 | HSL | glow |
|---|---|---|---|---|
| 갑 | 목 | 양 | 155, 33%, 62% | `#7ebea3` |
| 을 | 목 | 음 | 155, 24%, 47% | `#5b957d` |
| 병 | 화 | 양 | 16, 55%, 69% | `#db9c84` |
| 정 | 화 | 음 | 16, 36%, 53% | `#b2735c` |
| 무 | 토 | 양 | 38, 42%, 65% | `#cbb080` |
| 기 | 토 | 음 | 38, 26%, 50% | `#a1885e` |
| 경 | 금 | 양 | 205, 27%, 73% | `#a8bdcd` |
| 신 | 금 | 음 | 205, 20%, 57% | `#7b95a7` |
| 임 | 수 | 양 | 229, 45%, 69% | `#8c99d4` |
| 계 | 수 | 음 | 229, 27%, 53% | `#6773a8` |

수 → 심해 청, 금 → 얼음빛 회청으로 옮겼다. 전통 오행색의 흑·백은 이 배경(`#06080f`)에서 색으로 기능하지 못한다. 이건 Project Saju 의 시각 제안이지 명리의 공식 색 체계가 아니다 — 그래서 이 표는 파일 하나에 갇혀 있고 통째로 교체 가능하다.

채도 상한은 55%다. 5색 네온으로 보이지 않게 하는 유일한 장치다.

### 3.3 Inner core — 일주(60 Character)

core 는 glow 와 **같은 hue** 를 유지하고 채도·명도만 올린다. 그 위에 지지가 미세 변조를 얹는다.

```
core.sat   = clamp(glow.sat   + 15 + satOffset(지지))
core.light = clamp(glow.light + 10 + lightOffset(지지))

satOffset(i)   = ((i % 4) - 1.5) * 4          →  -6, -2, +2, +6
lightOffset(i) = (floor(i / 4) - 1) * 4       →  -4,  0, +4
```

`i` 는 `BRANCHES` 인덱스(0..11). 4 × 3 = 12개의 서로 다른 조합이므로 甲子 · 甲寅 · 甲辰 · 甲午 는 같은 계열 안에서 조금씩 다르다. 해시가 아니라 지지 인덱스에서 직접 나오므로 결정적이고 눈으로 검산된다.

`+15 / +10` 이 core 를 glow 보다 선명하게 만드는 항이다. 문서의 "Inner Core → 조금 더 선명하고 밀도 있는 색".

### 3.4 인터페이스

```ts
export type NodeColor = { readonly glow: string; readonly core: string };
export function colorFor(pillarKey: string): NodeColor;
```

`colorFor` 는 순수 함수다. React·three·DOM 을 import 하지 않는다 — 테스트가 node 환경에서 돈다.

## 4. Node 구조

3층이고, 층마다 하나씩만 담당한다.

| 층 | 반지름 | 재질 | 색 |
|---|---|---|---|
| 코어 | 0.075 | **opaque** `meshBasicMaterial` | `core` |
| 근접 halo | 0.28 | sprite, additive, α 0.55 | `glow` |
| 확산 halo | 0.95 | sprite, additive, α 0.07 | `glow` |

`나` 는 코어 반지름만 1.4배(0.105). 그 외에는 다른 사람과 같은 규칙을 따른다 — SELF 의 pillarKey 도 `"갑자"` 라서 자기 색을 갖는다.

### 4.1 코어가 opaque 여야 하는 이유

`transparent: true` 는 three 의 transparent 큐로 보내고, 그 큐는 픽셀이 아니라 오브젝트 원점 거리로 정렬된다. 코어를 opaque 로 두면 항상 먼저 그려지는 opaque 패스에 남아 깊이 버퍼를 채우고, 뒤따르는 모든 halo 가 그 코어를 상대로 진짜 픽셀 단위 depth test 를 받는다. **카메라를 돌렸을 때 앞뒤가 실제로 느껴진다**는 요구(문서 8절)는 여기서만 성립한다.

opaque 라 opacity 로는 상태를 표현할 수 없다. 선택/dim 은 색을 lerp 해서 표현한다(6절).

### 4.2 halo 는 셰이더 없이 만든다

radial falloff 텍스처 한 장을 `THREE.DataTexture` 로 계산해서 두 halo 층이 공유한다. 64×64 RGBA, 알파는 중심 1 → 가장자리 0 의 smoothstep.

- 순수 수학이라 `document` 를 건드리지 않는다. `"use client"` 모듈도 SSR 프리렌더에서 한 번 평가되므로 canvas 방식은 거기서 죽는다.
- `<sprite>` 는 three 가 알아서 카메라를 향하게 한다. 빌보드 코드가 필요 없다.
- **`extend` 가 코드베이스에서 완전히 사라진다.** 오늘 화면을 통째로 죽인 import elision 버그(`72dd8db`)의 부류 자체가 성립하지 않게 된다.

텍스처는 모듈 스코프에서 한 번 만들고 21명이 공유한다.

### 4.3 확산 halo 가 Field 를 만든다

사람 간 최소 간격은 0.4354다(`layout.test.ts` 가 잠근다). 확산 halo 반지름 0.95 는 그 2배가 넘으므로 이웃 2~3명과 겹친다. additive 라 겹친 자리의 알파는 대략 `0.07 × 겹친 수` — 3명이면 0.21, 6명이 몰린 fill 중심부에서 0.42.

이게 "사람들이 Field 를 만든다"의 전부다. 별도의 안개나 볼륨 오브젝트를 두지 않는다. 그런 걸 두면 방금 지운 Field 가 축소판으로 돌아온다.

## 5. 공간 = Role

`positionFor` 를 그대로 쓴다(2절). 사람은 같은 role 안에서도 서로 다른 깊이에 흩어진다.

**거리는 관계의 좋고 나쁨을 뜻하지 않는다.** 이 금지는 렌더러 독립적인 제품 원칙이고(최종 스펙 14절), 배치 함수가 `feature` 를 물리적으로 읽을 수 없게 타입으로 막혀 있다:

```ts
export type Placeable = { readonly id: string; readonly role: RelationRole };
```

`feature` 필드가 없으므로 배치가 六合/沖 을 참조하는 코드는 컴파일되지 않는다. 이 방벽은 유지한다.

## 6. 선택 상태

| 상태 | core | 근접 halo α | 확산 halo α |
|---|---|---|---|
| 기본 | `core` 색 | 0.55 | 0.07 |
| 선택 | `core` 색, 명도 +12 | 0.85 | 0.12 |
| dim | `core` 색, 명도 −28 · 채도 −40% | 0.12 | 0.015 |

`나 ↔ 선택` 사이에는 `RelationThread` 가 六合/沖 을 표시한다.

dim 상태에서도 색상(hue)은 유지한다. hue 까지 회색으로 빼면 "누가 어떤 사람인지"가 선택 중에 사라진다.

별도의 선택 테두리나 링을 추가하지 않는다. 모든 전이는 `useFrame` 안에서 lerp 한다.

`RelationThread` 와 `PersonSheet` 는 손대지 않는다. 六合/沖 은 이미 "선택했을 때 나와 상대 사이에 생기는 현상"으로 구현돼 있고, 좋음/나쁨으로 읽히지 않도록 두 표현의 밝기 총량을 같은 상수 하나에서 파생시켜 놨다.

## 7. 테스트

### 새로 — `_data/saju-colors.test.ts`

1. 60개 pillarKey(10 × 12 전수) 가 전부 해석된다
2. 목록에 없는 글자는 던진다. `"신미"` 의 신은 천간, `"무신"` 의 신은 지지로 파싱된다 — 두 사람의 색이 다르다
3. 같은 천간의 12개 일주는 hue 가 같고, (채도, 명도) 쌍이 12개 모두 다르다
4. core 는 언제나 glow 보다 채도·명도가 높다
5. 서로 다른 오행 쌍의 hue 거리 > 같은 오행 쌍의 hue 거리(= 0)
6. 10개 glow 색 전부 배경 `#06080f` 대비 명도비 4.0 이상 (현재 최저는 계 4.38)
7. 10개 **glow** 색의 채도가 55% 를 넘지 않는다 (core 는 +15 되므로 이 상한의 대상이 아니다)
8. `mock-people.ts` 의 21명 전원이 해석된다

### 삭제

`tint.test.ts`, `shaders/materials.test.ts` — 대상과 함께 사라진다.

### 유지

`layout.test.ts` 39개 전부. 배치는 바뀌지 않는다.

## 8. 성능

- 드로우 콜: 21명 × 3층 = 63. 이전 Field 5종보다 적다.
- 셰이더 컴파일 0회. DataTexture 1장(16KB).
- 오버드로우: 확산 halo 가 겹치지만 α 0.07 에 depthWrite 없음. 카메라가 클러스터 안으로 들어가도 halo 반지름이 작아 화면을 덮지 않는다 — 이전 Field 가 필요로 했던 근접 페이드 장치가 불필요하다.
- 후처리 없음.

## 9. 눈으로 정할 값

아래 두 값은 계산으로 정했고 렌더된 화면에서 검증되지 않았다. 한곳에 상수로 모아두고 실물을 본 뒤 조절한다.

```
DIFFUSE_HALO_RADIUS = 0.95
DIFFUSE_HALO_ALPHA  = 0.07
```

너무 크면 직전 스파이크의 "흰 덩어리"가 색깔만 바뀐 채 돌아오고, 너무 작으면 사람들이 그냥 흩뿌려진 점이 된다.

## 10. 이번 범위가 아닌 것

- 관계 엔진·백엔드 연결. mock 데이터만 쓴다.
- 60종 일러스트, standee, 카드 오브젝트.
- 최종 Color Rule 확정. 이번엔 "사주에 따라 내부/외곽 톤이 달라지는 구조가 시각적으로 괜찮은지"만 본다.
- 六合/沖 외의 Feature(刑·破·害·三合).
- Field 오브젝트의 부활. 필요하면 git 에서 꺼낸다.
