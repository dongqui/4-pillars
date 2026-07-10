import type { BirthInput, Gender } from "@/lib/saju-core";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface ParsedRequest {
  name: string;
  input: BirthInput;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function intInRange(v: unknown, min: number, max: number, field: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) {
    throw new ValidationError(`${field}은(는) ${min}~${max} 사이의 정수여야 합니다`);
  }
  return v;
}

export function parseRequest(raw: unknown): ParsedRequest {
  if (!isRecord(raw)) {
    throw new ValidationError("요청 본문이 객체가 아닙니다");
  }

  const name = raw.name;
  if (typeof name !== "string" || name.trim() === "") {
    throw new ValidationError("name은 필수입니다");
  }

  if (raw.gender !== "male" && raw.gender !== "female") {
    throw new ValidationError("gender는 'male' 또는 'female'이어야 합니다");
  }
  const gender = raw.gender as Gender;

  let calendar: "solar" | "lunar" | undefined;
  if (raw.calendar !== undefined) {
    if (raw.calendar !== "solar" && raw.calendar !== "lunar") {
      throw new ValidationError("calendar는 'solar' 또는 'lunar'여야 합니다");
    }
    calendar = raw.calendar;
  }

  const year = intInRange(raw.year, 1900, 2200, "year");
  const month = intInRange(raw.month, 1, 12, "month");
  const day = intInRange(raw.day, 1, 31, "day");

  const hour = raw.hour === undefined ? undefined : intInRange(raw.hour, 0, 23, "hour");
  const minute = raw.minute === undefined ? undefined : intInRange(raw.minute, 0, 59, "minute");

  const input: BirthInput = {
    year,
    month,
    day,
    hour,
    minute,
    calendar,
    gender,
    isLeapMonth: raw.isLeapMonth === true ? true : undefined,
    longitude: typeof raw.longitude === "number" ? raw.longitude : undefined,
    applyTimeCorrection:
      typeof raw.applyTimeCorrection === "boolean" ? raw.applyTimeCorrection : undefined,
  };

  return { name: name.trim(), input };
}
