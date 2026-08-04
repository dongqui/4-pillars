export type Country = "KR" | "JP";

export interface Region {
  /** 안정적 식별자 */
  id: string;
  /** 한국어 라벨 */
  ko: string;
  /** 일본어 라벨 */
  ja: string;
  /** 대표 경도 (도청/현청 소재지) */
  lon: number;
}

// 대표 경도 = 도청 소재지
export const KR_REGIONS: Region[] = [
  { id: "seoul", ko: "서울", ja: "ソウル", lon: 126.98 },
  { id: "busan", ko: "부산", ja: "釜山", lon: 129.08 },
  { id: "daegu", ko: "대구", ja: "大邱", lon: 128.6 },
  { id: "incheon", ko: "인천", ja: "仁川", lon: 126.71 },
  { id: "gwangju", ko: "광주", ja: "光州", lon: 126.85 },
  { id: "daejeon", ko: "대전", ja: "大田", lon: 127.38 },
  { id: "ulsan", ko: "울산", ja: "蔚山", lon: 129.31 },
  { id: "sejong", ko: "세종", ja: "世宗", lon: 127.29 },
  { id: "gyeonggi", ko: "경기", ja: "京畿", lon: 127.03 },
  { id: "gangwon", ko: "강원", ja: "江原", lon: 127.73 },
  { id: "chungbuk", ko: "충북", ja: "忠北", lon: 127.49 },
  { id: "chungnam", ko: "충남", ja: "忠南", lon: 126.66 },
  { id: "jeonbuk", ko: "전북", ja: "全北", lon: 127.11 },
  { id: "jeonnam", ko: "전남", ja: "全南", lon: 126.46 },
  { id: "gyeongbuk", ko: "경북", ja: "慶北", lon: 128.73 },
  { id: "gyeongnam", ko: "경남", ja: "慶南", lon: 128.68 },
  { id: "jeju", ko: "제주", ja: "済州", lon: 126.53 },
];

// 대표 경도 = 県庁所在地
export const JP_REGIONS: Region[] = [
  { id: "hokkaido", ko: "홋카이도", ja: "北海道", lon: 141.35 },
  { id: "aomori", ko: "아오모리", ja: "青森県", lon: 140.74 },
  { id: "iwate", ko: "이와테", ja: "岩手県", lon: 141.15 },
  { id: "miyagi", ko: "미야기", ja: "宮城県", lon: 140.87 },
  { id: "akita", ko: "아키타", ja: "秋田県", lon: 140.1 },
  { id: "yamagata", ko: "야마가타", ja: "山形県", lon: 140.36 },
  { id: "fukushima", ko: "후쿠시마", ja: "福島県", lon: 140.47 },
  { id: "ibaraki", ko: "이바라키", ja: "茨城県", lon: 140.45 },
  { id: "tochigi", ko: "도치기", ja: "栃木県", lon: 139.88 },
  { id: "gunma", ko: "군마", ja: "群馬県", lon: 139.06 },
  { id: "saitama", ko: "사이타마", ja: "埼玉県", lon: 139.65 },
  { id: "chiba", ko: "지바", ja: "千葉県", lon: 140.12 },
  { id: "tokyo", ko: "도쿄", ja: "東京都", lon: 139.69 },
  { id: "kanagawa", ko: "가나가와", ja: "神奈川県", lon: 139.64 },
  { id: "niigata", ko: "니가타", ja: "新潟県", lon: 139.02 },
  { id: "toyama", ko: "도야마", ja: "富山県", lon: 137.21 },
  { id: "ishikawa", ko: "이시카와", ja: "石川県", lon: 136.63 },
  { id: "fukui", ko: "후쿠이", ja: "福井県", lon: 136.22 },
  { id: "yamanashi", ko: "야마나시", ja: "山梨県", lon: 138.57 },
  { id: "nagano", ko: "나가노", ja: "長野県", lon: 138.18 },
  { id: "gifu", ko: "기후", ja: "岐阜県", lon: 136.72 },
  { id: "shizuoka", ko: "시즈오카", ja: "静岡県", lon: 138.38 },
  { id: "aichi", ko: "아이치", ja: "愛知県", lon: 136.91 },
  { id: "mie", ko: "미에", ja: "三重県", lon: 136.51 },
  { id: "shiga", ko: "시가", ja: "滋賀県", lon: 135.87 },
  { id: "kyoto", ko: "교토", ja: "京都府", lon: 135.76 },
  { id: "osaka", ko: "오사카", ja: "大阪府", lon: 135.52 },
  { id: "hyogo", ko: "효고", ja: "兵庫県", lon: 135.18 },
  { id: "nara", ko: "나라", ja: "奈良県", lon: 135.83 },
  { id: "wakayama", ko: "와카야마", ja: "和歌山県", lon: 135.17 },
  { id: "tottori", ko: "돗토리", ja: "鳥取県", lon: 134.24 },
  { id: "shimane", ko: "시마네", ja: "島根県", lon: 133.05 },
  { id: "okayama", ko: "오카야마", ja: "岡山県", lon: 133.93 },
  { id: "hiroshima", ko: "히로시마", ja: "広島県", lon: 132.46 },
  { id: "yamaguchi", ko: "야마구치", ja: "山口県", lon: 131.47 },
  { id: "tokushima", ko: "도쿠시마", ja: "徳島県", lon: 134.56 },
  { id: "kagawa", ko: "가가와", ja: "香川県", lon: 134.04 },
  { id: "ehime", ko: "에히메", ja: "愛媛県", lon: 132.77 },
  { id: "kochi", ko: "고치", ja: "高知県", lon: 133.53 },
  { id: "fukuoka", ko: "후쿠오카", ja: "福岡県", lon: 130.42 },
  { id: "saga", ko: "사가", ja: "佐賀県", lon: 130.3 },
  { id: "nagasaki", ko: "나가사키", ja: "長崎県", lon: 129.87 },
  { id: "kumamoto", ko: "구마모토", ja: "熊本県", lon: 130.74 },
  { id: "oita", ko: "오이타", ja: "大分県", lon: 131.61 },
  { id: "miyazaki", ko: "미야자키", ja: "宮崎県", lon: 131.42 },
  { id: "kagoshima", ko: "가고시마", ja: "鹿児島県", lon: 130.56 },
  { id: "okinawa", ko: "오키나와", ja: "沖縄県", lon: 127.68 },
];

export const DEFAULT_REGION_ID: Record<Country, string> = {
  KR: "seoul",
  JP: "tokyo",
};

export function getRegions(country: Country): Region[] {
  return country === "KR" ? KR_REGIONS : JP_REGIONS;
}

export function findRegion(country: Country, id: string): Region | undefined {
  return getRegions(country).find((r) => r.id === id);
}

/** birthPlace가 null(스킵)이면 국가 기본 지역 경도로 대체한다. */
export function resolveLongitude(
  birthPlace: { country: Country; regionId: string } | null,
  country: Country,
): number {
  if (birthPlace) {
    const r = findRegion(birthPlace.country, birthPlace.regionId);
    if (r) return r.lon;
  }
  const fallback = findRegion(country, DEFAULT_REGION_ID[country]);
  // DEFAULT_REGION_ID는 항상 유효한 지역을 가리키므로 fallback은 존재한다.
  return fallback!.lon;
}
