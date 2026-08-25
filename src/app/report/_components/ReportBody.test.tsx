import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FREE_SECTION_KEYS,
  PAID_SECTION_KEYS,
  SECTION_KEYS,
  sectionHeading,
  type SectionKey,
} from "@/app/api/saju/_lib/sections";
import { ReportBody } from "./ReportBody";
import { sampleReport } from "../_lib/report-content.fixture";

const html = renderToStaticMarkup(
  <ReportBody content={sampleReport} access={{ isLoggedIn: true, isUnlocked: true }} />,
);

/** 머리말이 렌더된 위치. SectionHeading 이 "no · category" 를 그대로 찍는다. */
function headingPositions(keys: SectionKey[]) {
  return keys.map((key) => {
    const { no, category } = sectionHeading(key);
    const needle = `${no} · ${category}`;
    return { needle, at: html.indexOf(needle) };
  });
}

function expectRegistryOrder(keys: SectionKey[]) {
  const found = headingPositions(keys);
  for (const { needle, at } of found) {
    expect(at, `"${needle}" 가 화면에 없다`).toBeGreaterThan(-1);
  }
  const positions = found.map((f) => f.at);
  expect(positions, "화면 순서가 레지스트리 순서와 어긋난다").toEqual(
    [...positions].sort((a, b) => a - b),
  );
}

describe("ReportBody 화면 순서", () => {
  // registry.ts 의 SECTIONS 선언 순서가 번호를 만들고(derive.ts: sectionHeading),
  // 여기 JSX 순서가 실제 화면을 만든다 — 둘은 서로 다른 파일이라 타입 체크가
  // 어긋남을 잡아주지 않는다. SectionHeading 이 "no · category" 를 그대로 찍으므로
  // 렌더된 HTML 에서 그 문자열이 등장하는 위치를 비교해 화면 순서를 직접 검증한다.
  //
  // 기대 순서는 여기 손으로 적지 않고 PAID_SECTION_KEYS/sectionHeading() 에서
  // 뽑는다 — 손으로 적으면 Task 5~7 이 섹션을 끼워 넣을 때마다 이 배열도 같이
  // 고쳐야 하고, 안 고치면 "레지스트리가 옮겨갔다"가 아니라 "문자열이 화면에
  // 없다"는 엉뚱한 실패로만 드러난다. registry.ts 를 유일한 정답으로 두면
  // 섹션이 늘어나도 이 테스트는 손댈 필요가 없다.
  it("잠금 해제 상태에서 유료 섹션이 레지스트리 번호 순서대로 나온다", () => {
    expectRegistryOrder(PAID_SECTION_KEYS);
  });

  // 무료 4개는 JSX 에 고정 순서로 박혀 있어(ReportBody 의 Hero~CautionsSection),
  // 레지스트리에서 이들 순서를 바꾸면 번호만 갈아끼워지고 화면은 그대로다.
  // 유료만 검사하면 그 어긋남이 아무 데서도 안 걸린다.
  it("무료 섹션도 레지스트리 번호 순서대로 나온다", () => {
    expectRegistryOrder(FREE_SECTION_KEYS);
  });

  // 무료·유료를 따로 본 것만으로는 두 덩어리의 경계가 안 잡힌다 — 유료가 무료
  // 앞으로 올라가도 각 검사는 통과한다. 전체를 한 줄로 세워 그 자리를 막는다.
  it("무료와 유료를 이어 붙인 13개 전체가 한 줄로 정렬된다", () => {
    expectRegistryOrder(SECTION_KEYS);
  });
});
