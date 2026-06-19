import type { Messages } from "./messages.js";
import { ko } from "./ko.js";
import { ja } from "./ja.js";

export type { Messages };
export type Locale = "ko" | "ja";

export const messages: Record<Locale, Messages> = { ko, ja };

export function t(locale: Locale): Messages {
  return messages[locale];
}
