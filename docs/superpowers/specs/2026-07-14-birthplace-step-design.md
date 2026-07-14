# 출생지 스텝 + 경도 보정 설계

- 날짜: 2026-07-14
- 상태: 설계 확정 대기 (사용자 리뷰 전)
- 관련: `2026-07-10-landing-and-funnel-design.md`, `2026-07-10-saju-api-design.md`

## 배경 / 문제

이 서비스는 한국과 일본을 함께 지원한다. 사주의 시주(時)는 **진태양시 보정**에 따라 자주 바뀌는데, 보정량은 출생지 경도에 의존한다.

라이브러리(`@fullstackfamily/manseryeok`)의 보정식:

```
standardMeridian = 135        // 한·일 공통 표준시 자오선 (UTC+9)
correction(분) = round((135 - longitude) * 4)   // 경도차만, 균시차 미적용
trueTime = clockTime - correction
```

135°E 자오선이 일본 아카시(明石)를 관통하므로 보정 부호가 한국과 반대다.

| 출생지 | 경도 | 보정 | 12:00 출생 → 진태양시 |
| --- | --- | --- | --- |
| 서울 | 126.98°E | −32분 | 11:28 |
| 도쿄 | 139.69°E | +19분 | 12:19 |

서울(127) 고정 경도를 일본인에게 쓰면 도쿄와 약 51분 오차가 나 시주(2시간 경계)가 자주 뒤집힌다. 현재 퍼널은 출생지를 수집하지 않아 라이브러리 기본값 127로만 계산된다. 이는 일본 사용자에게 틀린 결과를 준다.

**목표:** 출생지(지역)를 수집해 국가·지역에 맞는 경도를 계산에 전달한다. 경도 보정은 시주에만 영향을 주므로, 출생 시간을 입력한 경우에만 수집한다.

## 결정 사항

- 출생지는 **별도 스텝**으로 추가하고 `timeKnown === true`일 때만 노출한다.
- 국가는 **locale로 자동 결정**한다 (`ko → KR`, `ja → JP`). 현재 i18n이 없으므로 `getLocale()`는 `"ko"` 고정이며, 추후 ja 대응 시 스위치만 교체한다. **국가 수동 변경 UI는 두지 않는다.**
- 지역 선택은 **검색 가능한 리스트**로 제공한다 (일본 47개 때문에 그리드 부적합).
- 지역 선택을 **스킵**할 수 있다 (`BirthTimeStep`의 "시간 몰라요"와 동일한 패턴). 스킵 시 경도는 해당 국가 기본 지역(서울/도쿄)으로 대체한다.
- 지역 단위는 **한국 시/도(17), 일본 都道府県(47)**. 도시·시군구 세분화는 범위 밖.

## 범위에서 제외

- 국가 수동 변경 UI ("다른 나라에서 태어났어요" 링크)
- 도시/시군구 단위 세분화
- 균시차(equation of time) — 라이브러리가 적용하지 않음
- 지도·주소 자동완성 등 외부 API

## 아키텍처

### 1. 지역 데이터 — `src/app/funnel/_lib/regions.ts` (신설)

```ts
export type Country = "KR" | "JP";

export interface Region {
  id: string;   // 안정적 식별자 (예: "seoul", "tokyo")
  ko: string;   // 한국어 라벨
  ja: string;   // 일본어 라벨
  lon: number;  // 대표 경도 (도청/현청 소재지)
}

export const KR_REGIONS: Region[];   // 17 시/도
export const JP_REGIONS: Region[];   // 47 都道府県

export const DEFAULT_REGION_ID: Record<Country, string> = {
  KR: "seoul",
  JP: "tokyo",
};

export function getRegions(country: Country): Region[];
export function findRegion(country: Country, id: string): Region | undefined;

/** birthPlace가 null(스킵)이면 국가 기본 지역 경도로 대체 */
export function resolveLongitude(
  birthPlace: { country: Country; regionId: string } | null,
  country: Country,
): number;
```

경도 보정 계산 자체는 라이브러리가 담당한다. 이 모듈은 **지역 → 경도 매핑만** 제공한다.

#### KR_REGIONS (대표 경도 = 도청 소재지)

| id | ko | ja | lon |
| --- | --- | --- | --- |
| seoul | 서울 | ソウル | 126.98 |
| busan | 부산 | 釜山 | 129.08 |
| daegu | 대구 | 大邱 | 128.60 |
| incheon | 인천 | 仁川 | 126.71 |
| gwangju | 광주 | 光州 | 126.85 |
| daejeon | 대전 | 大田 | 127.38 |
| ulsan | 울산 | 蔚山 | 129.31 |
| sejong | 세종 | 世宗 | 127.29 |
| gyeonggi | 경기 | 京畿 | 127.03 |
| gangwon | 강원 | 江原 | 127.73 |
| chungbuk | 충북 | 忠北 | 127.49 |
| chungnam | 충남 | 忠南 | 126.66 |
| jeonbuk | 전북 | 全北 | 127.11 |
| jeonnam | 전남 | 全南 | 126.46 |
| gyeongbuk | 경북 | 慶北 | 128.73 |
| gyeongnam | 경남 | 慶南 | 128.68 |
| jeju | 제주 | 済州 | 126.53 |

#### JP_REGIONS (대표 경도 = 県庁所在地)

| id | ko | ja | lon |
| --- | --- | --- | --- |
| hokkaido | 홋카이도 | 北海道 | 141.35 |
| aomori | 아오모리 | 青森県 | 140.74 |
| iwate | 이와테 | 岩手県 | 141.15 |
| miyagi | 미야기 | 宮城県 | 140.87 |
| akita | 아키타 | 秋田県 | 140.10 |
| yamagata | 야마가타 | 山形県 | 140.36 |
| fukushima | 후쿠시마 | 福島県 | 140.47 |
| ibaraki | 이바라키 | 茨城県 | 140.45 |
| tochigi | 도치기 | 栃木県 | 139.88 |
| gunma | 군마 | 群馬県 | 139.06 |
| saitama | 사이타마 | 埼玉県 | 139.65 |
| chiba | 지바 | 千葉県 | 140.12 |
| tokyo | 도쿄 | 東京都 | 139.69 |
| kanagawa | 가나가와 | 神奈川県 | 139.64 |
| niigata | 니가타 | 新潟県 | 139.02 |
| toyama | 도야마 | 富山県 | 137.21 |
| ishikawa | 이시카와 | 石川県 | 136.63 |
| fukui | 후쿠이 | 福井県 | 136.22 |
| yamanashi | 야마나시 | 山梨県 | 138.57 |
| nagano | 나가노 | 長野県 | 138.18 |
| gifu | 기후 | 岐阜県 | 136.72 |
| shizuoka | 시즈오카 | 静岡県 | 138.38 |
| aichi | 아이치 | 愛知県 | 136.91 |
| mie | 미에 | 三重県 | 136.51 |
| shiga | 시가 | 滋賀県 | 135.87 |
| kyoto | 교토 | 京都府 | 135.76 |
| osaka | 오사카 | 大阪府 | 135.52 |
| hyogo | 효고 | 兵庫県 | 135.18 |
| nara | 나라 | 奈良県 | 135.83 |
| wakayama | 와카야마 | 和歌山県 | 135.17 |
| tottori | 돗토리 | 鳥取県 | 134.24 |
| shimane | 시마네 | 島根県 | 133.05 |
| okayama | 오카야마 | 岡山県 | 133.93 |
| hiroshima | 히로시마 | 広島県 | 132.46 |
| yamaguchi | 야마구치 | 山口県 | 131.47 |
| tokushima | 도쿠시마 | 徳島県 | 134.56 |
| kagawa | 가가와 | 香川県 | 134.04 |
| ehime | 에히메 | 愛媛県 | 132.77 |
| kochi | 고치 | 高知県 | 133.53 |
| fukuoka | 후쿠오카 | 福岡県 | 130.42 |
| saga | 사가 | 佐賀県 | 130.30 |
| nagasaki | 나가사키 | 長崎県 | 129.87 |
| kumamoto | 구마모토 | 熊本県 | 130.74 |
| oita | 오이타 | 大分県 | 131.61 |
| miyazaki | 미야자키 | 宮崎県 | 131.42 |
| kagoshima | 가고시마 | 鹿児島県 | 130.56 |
| okinawa | 오키나와 | 沖縄県 | 127.68 |

### 2. 국가 판별 — `src/app/funnel/_lib/locale.ts` (신설)

```ts
export type Locale = "ko" | "ja";

/** 현재 locale. i18n 도입 전까지 "ko" 고정. */
export function getLocale(): Locale;

export function localeToCountry(locale: Locale): Country; // ko→KR, ja→JP
```

향후 i18n이 붙으면 `getLocale()` 내부만 교체한다.

### 3. 상태 — `FunnelContext`

```ts
export interface FunnelData {
  // ...기존 필드...
  timeKnown: boolean;
  time: { h: number; m: number } | null;
  birthPlace: { country: Country; regionId: string } | null;  // 신규
  trueSolar: boolean;   // 기존 유지
}
```

- 초기값 `birthPlace: null`.
- 출생지 스텝 진입 시 `birthPlace`가 null이면 추정 국가의 기본 지역(서울/도쿄)을 **화면상 프리셋**한다. 사용자가 다른 지역을 선택하거나 스킵할 수 있다.
- 스킵을 명시하면 `birthPlace = null`로 두고 진행한다.

### 4. 스텝 네비게이션 — `_lib/steps.ts` (동적화)

`STEPS`가 정적 배열이라 조건부 스텝을 넣을 수 없다. 데이터 기반으로 동적화한다.

```ts
export type StepKey = "name" | "gender" | "birth" | "time" | "birthplace" | "review";

/** timeKnown일 때만 birthplace 포함 */
export function activeSteps(data: Pick<FunnelData, "timeKnown">): StepKey[] {
  return data.timeKnown
    ? ["name", "gender", "birth", "time", "birthplace", "review"]
    : ["name", "gender", "birth", "time", "review"];
}
```

`nextStep`/`prevStep`/`stepIndex`/총계는 모두 `activeSteps(data)` 기준으로 계산한다. `useFunnelNav`가 `useFunnel()` 데이터를 읽어 활성 목록을 만든다. 진행바 `total`도 활성 목록 길이로 자동 반영된다.

`timeKnown`을 껐다 켤 때 현재 스텝이 사라지는 경계는 없다(birthplace는 항상 time과 review 사이). 다만 `time` 스텝에서 "시간 몰라요"를 켠 채 next를 누르면 `activeSteps`에서 birthplace가 빠져 곧장 review로 간다.

### 5. UI — `steps/BirthPlaceStep.tsx` (신설)

- 제목: "어디서 태어났나요?"
- 부제: "출생지 경도로 시(時)를 정밀 보정해요."
- 추정 국가(`localeToCountry(getLocale())`)의 지역 목록을 **검색 입력 + 스크롤 리스트**로 표시. 라벨은 locale에 맞춰 `ko`/`ja` 필드 사용.
- 기본 지역(서울/도쿄)이 선택 상태로 프리셋. 항목 탭 시 `birthPlace = { country, regionId }` 갱신.
- 하단에 스킵 버튼 "출생지를 몰라요" — `BirthTimeStep`의 토글 버튼과 동일한 스타일. 누르면 `birthPlace = null`로 두고 다음으로 진행 가능.
- 기존 컴포넌트(`SegmentedControl` 등) 스타일 토큰을 재사용해 퍼널 디자인과 일관성 유지.

### 6. 확인 화면 — `ReviewStep`

- "출생지" 행 추가:
  - `birthPlace`가 있으면 해당 지역 라벨(예: `서울`, `東京`).
  - null(스킵)이면 `출생지 모름`.
  - `timeKnown === false`면 행 자체를 숨김(시주 없음).
- 기존 `진태양시 보정` 토글 유지. OFF면 경도를 무시하고 보정을 끈다(문구 유지).

### 7. API 연동 — `toBirthInput()` 헬퍼

제출 시 매핑:

```ts
const country = localeToCountry(getLocale());
const input: BirthInput = {
  // ...year, month, day, hour, minute, gender, calendar...
  longitude: resolveLongitude(data.birthPlace, country),
  applyTimeCorrection: data.trueSolar,
};
```

현재 퍼널은 실제 API 호출 없이 `/report` 스텁으로 이동한다. 따라서 `toBirthInput()` 헬퍼를 준비해두고, API 배선 지점에 연결한다. `resolveLongitude`는 `birthPlace`가 null이어도 국가 기본 경도를 반환하므로 항상 유효한 값을 넘긴다.

## 데이터 흐름

```
locale ──localeToCountry──> country
                              │
BirthPlaceStep ── 선택/스킵 ──> data.birthPlace
                              │
toBirthInput ── resolveLongitude(birthPlace, country) ──> longitude
             ── data.trueSolar ──> applyTimeCorrection
                              │
                       POST /api/saju ──> calculateSaju(longitude, applyTimeCorrection)
```

## 테스트

- `regions.test.ts`: `getRegions`가 국가별 올바른 개수(17/47) 반환, 모든 id 유일, `resolveLongitude`가 (a) 지역 선택 시 해당 경도 (b) null일 때 국가 기본 경도 반환.
- `locale.test.ts`: `localeToCountry` 매핑.
- `steps.test.ts`: `activeSteps`가 `timeKnown`에 따라 birthplace 포함/제외, `nextStep`/`prevStep`이 활성 목록 기준으로 동작(time→birthplace→review, 스킵 시 time→review).
- `BirthPlaceStep` 컴포넌트: 기본 지역 프리셋, 검색 필터, 스킵이 `birthPlace`를 null로 만드는지.

## 열린 질문 / 리스크

- 대표 경도는 도청/현청 소재지 기준 근사값(소수 2자리). 같은 시/도 내 이동이 시주를 바꿀 수 있으나, 도시 단위 세분화는 이번 범위 밖으로 둔다.
- i18n 미도입 상태라 `getLocale()`는 `"ko"` 고정. ja 사용자는 i18n 도입 후에 실제로 KR/JP가 갈린다. 그 전까지 일본 지역 목록은 사실상 노출되지 않는다(수용).
