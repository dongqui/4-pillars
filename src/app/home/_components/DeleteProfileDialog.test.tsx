import { test, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import { DeleteProfileDialog } from "./DeleteProfileDialog";

const html = () =>
  renderToStaticMarkup(
    <DeleteProfileDialog profileId="7" name="백상현" onClose={() => {}} onDeleted={() => {}} />,
  );

// 프로필 삭제가 소프트 삭제가 된 뒤로(0050) 그 프로필로 본 궁합·흐름 결과는 남는다 —
// 돈 주고 산 것이 삭제로 사라지면 안 되어서다. 다이얼로그가 여전히 "함께 사라져요" 라고
// 말하면, 사람을 지우면서 결과도 지우려던 사용자는 지워졌다고 믿고 넘어간다.
test("이미 본 궁합 결과가 사라진다고 말하지 않는다", () => {
  expect(html()).not.toContain("함께 사라져요");
});

test("이미 본 궁합 결과는 남는다고 말한다", () => {
  expect(html()).toContain("이미 본 궁합 결과는 남아요");
});
