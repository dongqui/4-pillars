// @4-pillars/saju-core — 사주 원국 계산 및 분석
//
// manseryeok로 원국(사주팔자)을 구하고, 오행 분포·십성 분포·신강/신약·
// 용신/희신·대운을 자체 명리 로직으로 계산한다.

export { analyze, type SajuAnalysis } from "./analyze";
export {
  buildChart,
  type BirthInput,
  type Chart,
  type Gender,
  type Pillar,
} from "./chart";
export { distributeElements, type ElementDistribution } from "./elements";
export {
  analyzeTenGods,
  type TenGodCell,
  type TenGodResult,
  type PillarPosition,
} from "./ten-gods";
export {
  scoreStrength,
  levelFromRatio,
  POSITION_WEIGHTS,
  STRENGTH_THRESHOLDS,
  type StrengthLevel,
  type StrengthScore,
} from "./strength";
export { selectYongsin, type Yongsin } from "./yongsin";
export {
  computeDaeun,
  type Daeun,
  type DaeunPeriod,
  type LuckDirection,
} from "./luck";

// 데이터·관계 (콘텐츠/리포트 엔진에서 재사용)
export {
  STEMS,
  STEM_ORDER,
  isStem,
  type Element,
  type Stem,
  type StemInfo,
  type YinYang,
} from "./data/stems";
export {
  BRANCHES,
  BRANCH_ORDER,
  isBranch,
  type Branch,
  type BranchInfo,
} from "./data/branches";
export {
  ELEMENTS,
  tenGod,
  tenGodGroup,
  elementGenerates,
  elementControls,
  generatedBy,
  controlledBy,
  type TenGod,
  type TenGodGroup,
} from "./data/relations";

// 절기(대운/월령 계산에 사용)
export { MONTH_TERMS, solarTermDate, type CalendarTime } from "./astro/solar-term";
