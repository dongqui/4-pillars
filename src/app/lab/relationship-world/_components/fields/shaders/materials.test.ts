import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * 이 스위트가 막는 것은 "빌드도 타입체크도 테스트도 전부 통과하는데 화면은
 * 통째로 죽는" 실패다. 실제로 한 번 그렇게 머지됐다.
 *
 * `<mistMaterial>` 같은 소문자 JSX 태그는 문자열 intrinsic 이라 MistMaterial
 * 바인딩을 참조하지 않는다. 컴포넌트가 그 바인딩을 쓰는 곳이
 * `InstanceType<typeof MistMaterial>` 뿐이면 전부 타입 위치이고, TS/SWC 의
 * import elision 이 `import ... from "./shaders/materials"` 를 트랜스파일
 * 단계에서 삭제한다. 그러면 materials.ts 가 런타임 모듈 그래프에 아예 들어오지
 * 않아 extend 가 한 번도 실행되지 않고, 다섯 Field 가 전부
 * "R3F: MistMaterial is not part of the THREE namespace!" 로 죽는다.
 *
 * 타입 검사는 이걸 못 잡는다 — 타입 관점에선 아무 문제가 없기 때문이다. 그래서
 * 타입이 아니라 **트랜스파일 결과**를 직접 본다. 실패 모드를 그대로 재현하는
 * 검사라 문자열 매칭보다 정확하다(extend 를 어디에 어떻게 쓰든, import 만
 * 살아남으면 통과한다).
 */

const FIELDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const MATERIALS_SPECIFIER = /shaders\/materials/;

function transpile(source: string, fileName: string): string {
  return ts.transpileModule(source, {
    fileName,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2017,
      jsx: ts.JsxEmit.ReactJSX,
      // tsconfig.json 과 같은 조건. verbatimModuleSyntax 를 켜지 않은 상태가
      // 곧 elision 이 도는 상태이고, 이 테스트가 지키려는 것도 그 상태다.
      isolatedModules: true,
    },
  }).outputText;
}

/** materials.ts 를 import 하는 컴포넌트를 직접 찾는다 — 새 Field 가 늘어도 자동으로 걸린다. */
const consumers = readdirSync(FIELDS_DIR)
  .filter((f) => f.endsWith(".tsx"))
  .map((f) => ({ name: f, source: readFileSync(join(FIELDS_DIR, f), "utf8") }))
  .filter((f) => MATERIALS_SPECIFIER.test(f.source));

describe("Field 마테리얼 등록", () => {
  it("materials.ts 를 쓰는 컴포넌트가 다섯 개 다 잡힌다", () => {
    // 파일 이름이 바뀌거나 import 경로가 바뀌어서 이 스위트가 아무것도 검사하지
    // 않는 상태로 조용히 통과하는 것을 막는다.
    expect(consumers.map((c) => c.name).sort()).toEqual([
      "BesideLayers.tsx",
      "ExpressRays.tsx",
      "FillVolume.tsx",
      "MoveRibbons.tsx",
      "RefineShards.tsx",
    ]);
  });

  it.each(consumers.map((c) => c.name))(
    "%s 의 materials import 가 트랜스파일 후에도 살아남는다",
    (name) => {
      const { source } = consumers.find((c) => c.name === name)!;
      expect(MATERIALS_SPECIFIER.test(transpile(source, name))).toBe(true);
    },
  );

  it("타입 위치에서만 쓰면 실제로 사라진다 — 위 검사가 진짜 검사임을 보인다", () => {
    const typeOnly = `
      import { MistMaterial } from "./shaders/materials";
      export const r: InstanceType<typeof MistMaterial> | null = null;
    `;
    expect(MATERIALS_SPECIFIER.test(transpile(typeOnly, "TypeOnly.tsx"))).toBe(false);
  });
});
