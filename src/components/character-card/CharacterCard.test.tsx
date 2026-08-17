import { test, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ALL_CHARACTERS, characterOf } from "@/lib/saju-core/character";
import { CharacterCard } from "./CharacterCard";
import { CARD_LIGHT_ACCENTS, CARD_TONES } from "./tokens";

test("60종이 파라미터만으로 렌더된다", () => {
  for (const character of ALL_CHARACTERS) {
    const html = renderToStaticMarkup(<CharacterCard character={character} />);

    // 카드에 나가는 필드가 전부 실렸는지 — 하나라도 비면 데이터 구멍이다
    expect(html).toContain(character.scene.name);
    expect(html).toContain(character.copy.hook);
    expect(html).toContain(character.copy.desc);
    expect(html).toContain(character.copy.shadow);
    expect(html).toContain(character.internal.basis);
    for (const chip of character.copy.chips) expect(html).toContain(chip);

    // 오행 서피스와 액센트는 일간에서만 나온다
    expect(html).toContain(CARD_TONES[character.family.element].surface);
    expect(html).toContain(CARD_TONES[character.family.element].accent);
  }
});

test("장면명은 글자 수로 크기만 내리고 줄바꿈하지 않는다", () => {
  const long = ALL_CHARACTERS.filter((c) => c.scene.name.length > 9);
  const short = ALL_CHARACTERS.filter((c) => c.scene.name.length <= 9);
  // 두 갈래가 실제로 다 존재해야 이 테스트가 의미를 갖는다
  expect(long.length).toBeGreaterThan(0);
  expect(short.length).toBeGreaterThan(0);

  for (const c of [...long, ...short]) {
    const html = renderToStaticMarkup(<CharacterCard character={c} />);
    const size = c.scene.name.length <= 9 ? "84px" : "72px";
    expect(html).toContain(`font-size:${size}`);
    expect(html).toContain("white-space:nowrap");
  }
});

test("zoomW 를 w 보다 작게 주면 캔버스만 넓어진다", () => {
  const c = characterOf("갑", "자");
  const same = renderToStaticMarkup(<CharacterCard character={c} w={500} />);
  const wider = renderToStaticMarkup(<CharacterCard character={c} w={500} zoomW={460} />);

  // 배율은 zoomW 가 정한다 — 같은 zoom 이면 글자 크기가 같다
  expect(same).toContain(`zoom:${500 / 1080}`);
  expect(wider).toContain(`zoom:${460 / 1080}`);
  // 캔버스 폭은 w/배율로 역산되므로 zoomW 가 작을수록 넓다
  expect(same).toContain("width:1080px");
  expect(wider).toContain(`width:${Math.round(500 / (460 / 1080))}px`);
});

test("라이트 변형은 흰 배경에 오행 차트색을 쓴다", () => {
  const c = characterOf("병", "인");
  const html = renderToStaticMarkup(<CharacterCard character={c} light />);

  expect(html).toContain(CARD_LIGHT_ACCENTS[c.family.element]);
  expect(html).not.toContain(CARD_TONES[c.family.element].surface);
  expect(html).toContain("background:#fff");
});
