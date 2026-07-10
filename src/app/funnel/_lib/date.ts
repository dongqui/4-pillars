export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export function clampDay(y: number, m: number, d: number): number {
  return Math.min(d, daysInMonth(y, m));
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatDate(v: { y: number; m: number; d: number }): string {
  return `${v.y}. ${pad2(v.m)}. ${pad2(v.d)}.`;
}

export function formatTime(v: { h: number; m: number }): string {
  return `${pad2(v.h)}:${pad2(v.m)}`;
}
