/** 지도가 받는 생년월일 전부. 시각·성별·출생지는 일주에 영향이 없어 받지 않는다. */
export interface BirthLite {
  year: number;
  month: number;
  day: number;
  calendar: "solar" | "lunar";
  isLeapMonth: boolean;
}

export interface MapRow {
  id: string;
  /** 공개 URL 에 쓰는 값. id 는 연속 정수라 절대 노출하지 않는다. */
  shareId: string;
  ownerUserId: string;
  /** 이 지도의 주인 프로필. 백필이 못 채운 옛 행은 null — /map 진입에서 안 잡히고
   *  공유 링크로만 열린다. */
  profileId: string | null;
  center: BirthLite & { name: string };
  createdAt: string;
}

export interface MapPersonRow extends BirthLite {
  id: string;
  name: string;
}
