/**
 * D-day를 한국 날짜 기준으로 앱에서 직접 계산해요 (2026-10-19)
 * 스크래퍼가 만든 days_until은 수집한 시각 기준이라 하루가 어긋날 수 있어요.
 */
const kstDay = (ms: number) => Math.floor((ms + 9 * 3600e3) / 86400e3);

export function daysUntilKST(isoUtc?: string | null, fallback?: number | null): number | null {
  const t = isoUtc ? new Date(isoUtc).getTime() : NaN;
  if (Number.isNaN(t)) return fallback ?? null;
  return Math.max(0, kstDay(t) - kstDay(Date.now()));
}

export const ddayLabel = (n: number) => (n === 0 ? 'D-DAY' : `D-${n}`);
