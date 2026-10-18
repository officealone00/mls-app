/**
 * MLS 컵 플레이오프 진출 경쟁 계산 (2026-10-19)
 *
 * 2026 MLS: 팀당 34경기, 컨퍼런스별 상위 9팀 진출 (1~7위 1라운드 직행, 8~9위 와일드카드).
 * Decision Day 11월 7일, 와일드카드 11월 18일, MLS 컵 12월 18일 (mlssoccer.com).
 *
 * 남은 경기를 모두 이긴다고 쳐서 따지는 보수적인 계산이에요.
 * - 확정: 이 팀 승점 이상으로 올라올 수 있는 다른 팀이 9팀 미만
 * - 탈락: 이 팀이 남은 경기를 다 이겨도 넘을 수 없는 팀이 9팀 이상
 * 승점이 같아지는 경우는 위협으로 봐요(승수 등 동률 기준은 따지지 않아요).
 * 결과를 예측하지 않아요.
 */
import type { MLSTeamStanding } from './api';

export const SEASON_GAMES = 34;
export const PLAYOFF_SPOTS = 9;
export const DIRECT_SPOTS = 7;

export interface RaceRow {
  row: MLSTeamStanding;
  remaining: number;
  maxPoints: number;
  status: 'in' | 'out' | 'alive';
  /** 1라운드 직행(1~7위) 확정 여부 */
  directClinched: boolean;
  /** 다른 팀 결과와 상관없이 진출을 확정하려면 더 필요한 승점 (불가능하면 null) */
  needForPlayoff: number | null;
  /** 1~7위 직행을 스스로 확정하려면 더 필요한 승점 (불가능하면 null) */
  needForDirect: number | null;
}

/** 나를 뺀 팀들의 최대 승점 중 k번째로 큰 값 */
function kthMax(others: number[], k: number) {
  const s = [...others].sort((a, b) => b - a);
  return s[k - 1] ?? -Infinity;
}

export function computePlayoffRace(standings: MLSTeamStanding[]): RaceRow[] {
  const rows = standings.map((r) => {
    const remaining = Math.max(0, SEASON_GAMES - r.played);
    return { r, remaining, max: r.points + remaining * 3 };
  });
  return rows.map(({ r, remaining, max }) => {
    const others = rows.filter((o) => o.r.team_id !== r.team_id);
    const threats = others.filter((o) => o.max >= r.points).length;
    const surelyAbove = others.filter((o) => o.r.points > max).length;
    const status: RaceRow['status'] = threats < PLAYOFF_SPOTS ? 'in' : surelyAbove >= PLAYOFF_SPOTS ? 'out' : 'alive';
    const directClinched = others.filter((o) => o.max >= r.points).length < DIRECT_SPOTS;

    // 내가 P점이 되면 확정: 최대 승점이 P 이상인 다른 팀이 9팀 미만 → P > 9번째로 높은 최대 승점
    const otherMax = others.map((o) => o.max);
    const needP = kthMax(otherMax, PLAYOFF_SPOTS) + 1 - r.points;
    const needD = kthMax(otherMax, DIRECT_SPOTS) + 1 - r.points;
    const cap = remaining * 3;
    return {
      row: r,
      remaining,
      maxPoints: max,
      status,
      directClinched,
      needForPlayoff: status === 'in' ? 0 : needP <= cap ? Math.max(0, needP) : null,
      needForDirect: directClinched ? 0 : needD <= cap ? Math.max(0, needD) : null,
    };
  });
}
