/**
 * 관계 지도 UI 를 눈으로 보려고 지도에 가짜 사람을 채워 넣는다.
 *
 *   npm run map:seed                      # 지도가 하나면 그 지도에 25명
 *   npm run map:seed -- --count 30        # 인원수 지정
 *   npm run map:seed -- --share <shareId> # 지도가 여럿일 때 대상 지정
 *   npm run map:seed -- --reset           # 기존 사람을 지우고 다시 채운다
 *   npm run map:seed -- --dry             # DB 를 건드리지 않고 뽑은 명단만 본다
 *
 * ⚠️ 개발용이다. .env.local 의 DB 를 직접 건드린다.
 *
 * 왜 "이름 + 생년월일" 을 지어내는가: 지도의 자리(Role 5구역 × Feature 3소구역)는
 * 저장된 값이 아니라 **중심의 일주와 그 사람의 일주로 매번 계산되는 것**이다
 * (to-map-people.ts). 그래서 "충 소구역에 3명" 같은 그림을 만들려면 원하는 칸이
 * 나오는 생년월일을 역으로 찾아야 한다. 이 스크립트가 하는 일이 그것이다 —
 * 날짜를 훑어 15칸 버킷에 담아 두고, 칸마다 필요한 만큼 꺼내 쓴다.
 *
 * 같은 인자로 다시 돌리면 같은 명단이 나온다(날짜 선택에 난수가 없다). map_people
 * 의 dedupe 유니크 인덱스와 맞물려, 두 번 돌려도 사람이 두 배가 되지 않는다.
 */
import { neon } from "@neondatabase/serverless";
// 배럴(@/lib/saju-core)이 아니라 구체 파일에서 가져온다 — dump-sections.mts 와 같은
// 이유로, tsx 의 ESM 로더가 재수출 체인 너머의 이름을 못 찾는 경우가 있다.
import { buildPillars } from "@/lib/saju-core/chart";
import { getRelation, type RelationKind } from "@/lib/saju-core/relationship";
import { characterOf } from "@/lib/saju-core/character";
import type { Branch } from "@/lib/saju-core/data/branches";
import type { Stem } from "@/lib/saju-core/data/stems";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL(_UNPOOLED) 가 없습니다. `--env-file=.env.local` 로 실행하세요.");
}
const sql = neon(url);

// --- 인자 ---
const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
};
const shareArg = arg("share");
const count = Number(arg("count") ?? 25);
const reset = process.argv.includes("--reset");
const dry = process.argv.includes("--dry");

if (!Number.isInteger(count) || count < 1 || count > 50) {
  // 상한 50 은 store.ts 의 MAX_MAP_PEOPLE 이다. 넘겨봐야 API 가 막는 값이라 여기서 끊는다.
  throw new Error(`--count 는 1~50 의 정수여야 합니다 (받은 값: ${arg("count")})`);
}

// --- 대상 지도 ---
type MapRow = {
  id: string;
  share_id: string;
  center_name: string;
  center_birth_year: number;
  center_birth_month: number;
  center_birth_day: number;
  center_calendar: "solar" | "lunar";
  center_is_leap_month: boolean;
};

const maps = (await sql.query(
  shareArg
    ? "SELECT * FROM maps WHERE share_id = $1"
    : "SELECT * FROM maps ORDER BY id DESC",
  shareArg ? [shareArg] : [],
)) as unknown as MapRow[];

if (maps.length === 0) {
  throw new Error(
    shareArg
      ? `share_id=${shareArg} 인 지도가 없습니다.`
      : "지도가 하나도 없습니다. 앱에 로그인해 /map 을 한 번 열면 내 지도가 만들어집니다.",
  );
}
if (!shareArg && maps.length > 1) {
  console.error("지도가 여러 개입니다. --share 로 하나를 고르세요:");
  for (const m of maps) console.error(`  ${m.share_id}  (${m.center_name}님)`);
  process.exit(1);
}
const map = maps[0];

const center = {
  year: Number(map.center_birth_year),
  month: Number(map.center_birth_month),
  day: Number(map.center_birth_day),
  calendar: map.center_calendar,
  isLeapMonth: map.center_is_leap_month === true,
};
const centerPillars = buildPillars(center);
const centerDay = { stem: centerPillars.day.stem, branch: centerPillars.day.branch };
const centerChar = characterOf(centerDay.stem, centerDay.branch);
console.log(
  `지도: ${map.share_id} · 중심 ${map.center_name}님 (${centerChar.key} — ${centerChar.scene.name})`,
);

// --- 15칸 ---
type Feature = "none" | "yukhap" | "chung";
const KINDS: readonly RelationKind[] = ["생아", "비아", "아생", "아극", "극아"];
const ROLE_OF: Record<RelationKind, string> = {
  생아: "fill(채워주는)",
  비아: "beside(나란히)",
  아생: "express(표현하게)",
  아극: "move(움직이게)",
  극아: "refine(다듬는)",
};
const FEATURES: readonly Feature[] = ["none", "yukhap", "chung"];
const cellKey = (kind: RelationKind, feature: Feature) => `${kind}/${feature}`;

type Candidate = { year: number; month: number; day: number; stem: Stem; branch: Branch };

/**
 * 1980~2004 의 양력 날짜를 전부 훑어 15칸 + "동일일주" 버킷에 담는다.
 *
 * 일주는 60일 주기라 이 범위면 어느 칸이든 후보가 150개 넘게 쌓인다. 넉넉히 훑는
 * 이유는 뽑을 때 **연도를 흩기** 위해서다 — 앞에서부터 집으면 25명이 전부 1980년생이 된다.
 */
const buckets = new Map<string, Candidate[]>();
const sameDay: Candidate[] = [];
for (let y = 1980; y <= 2004; y += 1) {
  for (let m = 1; m <= 12; m += 1) {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let d = 1; d <= last; d += 1) {
      const pillars = buildPillars({ year: y, month: m, day: d, calendar: "solar" });
      const day = { stem: pillars.day.stem, branch: pillars.day.branch };
      const relation = getRelation(centerDay, day);
      const badge = relation.badges[0];
      const cand: Candidate = { year: y, month: m, day: d, ...day };
      if (badge === "동일일주") {
        sameDay.push(cand);
        continue;
      }
      const feature: Feature = badge === "육합" ? "yukhap" : badge === "충" ? "chung" : "none";
      const key = cellKey(relation.kind, feature);
      const list = buckets.get(key);
      if (list) list.push(cand);
      else buckets.set(key, [cand]);
    }
  }
}

// --- 칸별 인원 배분 ---
// 15칸을 하나씩 먼저 채운다 — UI 를 보려는 것이 목적이라, 한 칸이라도 비면 그 소구역
// 배치·배지를 못 본다. 남는 인원은 기본(none) 칸에 돌려 담는다. 실제 분포도 그렇다:
// 육합·충은 지지 12개 중 하나씩이라 열에 여덟은 기본 상태다.
const quota = new Map<string, number>();
for (const kind of KINDS) for (const f of FEATURES) quota.set(cellKey(kind, f), 1);

// 동일일주 한 명. 상세 시트에만 나오는 문장이라 지도 배치는 비아/none 으로 접힌다.
const wantSameDay = count >= 16;
let remaining = count - 15 - (wantSameDay ? 1 : 0);
if (remaining < 0) {
  // 15명 미만을 요청했으면 칸을 골고루 덜어낸다(뒤 칸부터).
  const cells = KINDS.flatMap((k) => FEATURES.map((f) => cellKey(k, f)));
  for (let i = cells.length - 1; remaining < 0; i -= 1, remaining += 1) {
    quota.set(cells[i], 0);
  }
}
for (let i = 0; remaining > 0; i += 1, remaining -= 1) {
  const key = cellKey(KINDS[i % KINDS.length], "none");
  quota.set(key, (quota.get(key) ?? 0) + 1);
}

// --- 이름 ---
// 지어낸 이름이다. 실존 인물과 무관하고, 수를 늘리려면 여기만 늘리면 된다.
const NAMES = [
  "민수", "지현", "태호", "서연", "준영", "하람", "은채", "도윤", "가온", "선우",
  "예린", "시우", "나윤", "건우", "채원", "지호", "소율", "우진", "다인", "현수",
  "유진", "상혁", "보람", "연우", "재이", "세아", "다올", "한별", "규민", "아린",
  "정우", "미르", "새록", "찬희", "온유", "리안", "주안", "슬기", "도경", "여울",
  "해원", "성찬", "나래", "윤슬", "태린", "가람", "은서", "지완", "하윤", "결",
];

// --- 뽑기 ---
type Picked = Candidate & { name: string; kind: RelationKind; feature: Feature; same: boolean };
const picked: Picked[] = [];
let nameIndex = 0;
const nextName = () => NAMES[nameIndex++ % NAMES.length];

let cellIndex = 0;
for (const kind of KINDS) {
  for (const feature of FEATURES) {
    const key = cellKey(kind, feature);
    // 칸마다 다른 위상(位相). 이게 없으면 한 명만 뽑는 칸이 전부 버킷 한가운데를
    // 집어, 열 명 넘는 사람의 생일이 같은 달에 몰린다.
    const phase = ((cellIndex++ * 7) % 15) / 15;
    const need = quota.get(key) ?? 0;
    if (need === 0) continue;
    const bucket = buckets.get(key) ?? [];
    if (bucket.length === 0) {
      // 어떤 칸이 아예 안 나오는 중심도 있다 — 설계상 있을 수 있는 일이라 죽이지 않는다.
      console.warn(`  (건너뜀) ${ROLE_OF[kind]} · ${feature} 후보 없음`);
      continue;
    }
    // 버킷 전체에 고르게 걸쳐 뽑는다. 연도가 흩어지라고 이렇게 한다.
    for (let i = 0; i < need; i += 1) {
      const at = Math.floor(((i + phase) * bucket.length) / need) % bucket.length;
      const c = bucket[at];
      picked.push({ ...c, name: nextName(), kind, feature, same: false });
    }
  }
}
if (wantSameDay && sameDay.length > 0) {
  const c = sameDay[Math.floor(sameDay.length / 2)];
  picked.push({ ...c, name: nextName(), kind: "비아", feature: "none", same: true });
}

console.log(`\n뽑은 사람 ${picked.length}명:`);
for (const p of picked) {
  const ch = characterOf(p.stem, p.branch);
  const tag = p.same ? "동일일주" : p.feature === "none" ? "" : p.feature === "yukhap" ? "六合" : "沖";
  console.log(
    `  ${p.name.padEnd(4)} ${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}` +
      `  ${ch.key} ${ch.scene.name.padEnd(14)} ${ROLE_OF[p.kind]} ${tag}`,
  );
}

if (dry) {
  console.log("\n--dry 라 DB 는 건드리지 않았습니다.");
  process.exit(0);
}

// --- 쓰기 ---
if (reset) {
  const gone = await sql.query("DELETE FROM map_people WHERE map_id = $1::bigint RETURNING id", [
    map.id,
  ]);
  console.log(`\n--reset: 기존 ${gone.length}명을 지웠습니다.`);
}

let inserted = 0;
for (const p of picked) {
  const rows = await sql.query(
    `INSERT INTO map_people (map_id, name, calendar, is_leap_month, birth_year, birth_month, birth_day)
     VALUES ($1::bigint, $2, 'solar', false, $3, $4, $5)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [map.id, p.name, p.year, p.month, p.day],
  );
  if (rows.length > 0) inserted += 1;
}

const total = await sql.query("SELECT count(*)::int n FROM map_people WHERE map_id = $1::bigint", [
  map.id,
]);
console.log(`\n새로 넣은 사람 ${inserted}명 · 지도의 총 인원 ${total[0].n}명`);
console.log(`열어 보기: /map/${map.share_id}`);
