/**
 * MLS 데이터 API
 * GitHub repo의 data/*.json을 jsdelivr CDN으로 불러옵니다.
 * 데이터 출처: ESPN unofficial API (스크래퍼가 매일 자동 갱신)
 */

import {
  FALLBACK_STANDINGS,
  FALLBACK_SON,
  FALLBACK_META,
  FALLBACK_SCORERS,
  FALLBACK_SCHEDULE,
  FALLBACK_KOREANS,
} from './fallback';
import type { Conference } from '@/data/teams';

const CONFIG = {
  githubUser: 'officealone00',
  repo: 'mls-app',
  branch: 'main',
};

function cdnUrl(path: string): string {
  const { githubUser, repo, branch } = CONFIG;
  return `https://cdn.jsdelivr.net/gh/${githubUser}/${repo}@${branch}/${path}`;
}

function cdnUrlBackup(path: string): string {
  const { githubUser, repo, branch } = CONFIG;
  return `https://raw.githubusercontent.com/${githubUser}/${repo}/${branch}/${path}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithRetry<T>(path: string, fallback: T): Promise<T> {
  const buster = Math.floor(Date.now() / (10 * 60 * 1000));
  const primary = `${cdnUrl(path)}?v=${buster}`;
  const backup = `${cdnUrlBackup(path)}?v=${buster}`;

  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetchWithTimeout(primary);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn(`[api] jsdelivr 시도 ${i + 1} 실패: ${path}`, e);
    }
    if (i < 2) await sleep(500 * Math.pow(2, i));
  }

  try {
    const res = await fetchWithTimeout(backup);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn(`[api] raw 폴백 실패: ${path}`, e);
  }

  console.warn(`[api] 모든 요청 실패, 폴백 데이터 사용: ${path}`);
  return fallback;
}

// ─── 공통 타입 ──────────────────────────────
export type FormItem = 'W' | 'D' | 'L';

// ─── 순위 ──────────────────────────────
export interface MLSTeamStanding {
  rank: number;
  team_id: string;
  team_name: string;
  team_short_name: string;
  team_abbr: string;
  team_logo: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  goal_diff_display: string;
  points: number;
  recent_form?: FormItem[];   // 최근 5경기 (오래된 → 최근 순)
}

export interface StandingsResponse {
  season: number;
  updated_at: string;
  eastern: MLSTeamStanding[];
  western: MLSTeamStanding[];
}

// ─── 손흥민 / LAFC ──────────────────────────────
export interface LAFCInfo {
  team_id: string;
  team_name: string;
  team_short_name: string;
  team_abbr: string;
  team_logo: string;
  venue: string;
  color: string;
  rank: number | null;
  points: number | null;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goals_for: number | null;
  goals_against: number | null;
  goal_diff: number | null;
  goal_diff_display: string;
}

export interface SonInfo {
  player_name: string;
  player_name_ko: string;
  nationality: string;
  nationality_ko: string;
  team_name: string;
  team_short_name: string;
  position: string;
  position_ko: string;
  jersey: string;
  age: number;
  photo: string;
  transfer_note: string;
  transfer_note_en: string;
  season: number;
  // 시즌 스탯 (옵셔널, 스크래퍼가 채움)
  appearances?: number;
  goals?: number;
  assists?: number;
  shots?: number;
  shots_on_target?: number;
  minutes?: number;
  yellow_cards?: number;
  red_cards?: number;
  goals_per_match?: number;
  league_goal_rank?: number;
  league_assist_rank?: number;
}

// 손흥민 지난 경기
export interface SonLastMatch {
  match_id: string;
  date: string;
  date_kst: string;
  kst_display?: string;
  competition: string;
  round: string;
  home: boolean;
  opponent_id: string;
  opponent_name: string;
  opponent_short: string;
  opponent_logo: string;
  home_score: number;
  away_score: number;
  result: FormItem;
  venue: string;
  son_played: boolean;
  son_minutes: number;
  son_goals: number;
  son_assists: number;
  son_shots?: number;
  son_rating?: number;
  son_man_of_the_match?: boolean;
  summary?: string;
}

// 손흥민 다음 경기
export interface SonNextMatch {
  match_id: string;
  date: string;
  date_kst: string;
  kst_display: string;
  competition: string;
  round: string;
  home: boolean;
  opponent_id: string;
  opponent_name: string;
  opponent_short: string;
  opponent_logo: string;
  venue: string;
  days_until: number;
  preview?: string;
}

export interface SonResponse {
  season: number;
  updated_at: string;
  lafc: LAFCInfo;
  son: SonInfo;
  last_match?: SonLastMatch;
  next_match?: SonNextMatch;
}

// ─── 득점왕 / 어시스트왕 ──────────────────────────────
export interface ScorerEntry {
  rank: number;
  player_id: string;
  player_name: string;
  player_name_ko: string;
  nationality: string;
  team_id: string;
  team_name: string;
  team_short: string;
  team_logo: string;
  goals: number;
  played: number;
  penalties: number;
}

export interface AssisterEntry {
  rank: number;
  player_id: string;
  player_name: string;
  player_name_ko: string;
  nationality: string;
  team_id: string;
  team_name: string;
  team_short: string;
  team_logo: string;
  assists: number;
  played: number;
}

export interface ScorersResponse {
  season: number;
  updated_at: string;
  scorers: ScorerEntry[];
  assisters: AssisterEntry[];
}

// ─── 팀별 일정 ──────────────────────────────
export interface TeamMatchResult {
  match_id: string;
  date: string;
  date_kst: string;
  kst_display: string;
  home: boolean;
  opponent_id: string;
  opponent_name: string;
  opponent_short: string;
  opponent_logo: string;
  home_score: number;
  away_score: number;
  result: FormItem;
  venue: string;
  round: string;
}

export interface TeamMatchUpcoming {
  match_id: string;
  date: string;
  date_kst: string;
  kst_display: string;
  home: boolean;
  opponent_id: string;
  opponent_name: string;
  opponent_short: string;
  opponent_logo: string;
  venue: string;
  days_until: number;
  round: string;
  // 예상 스코어 계산용 상대팀 시즌 통계 (스크래퍼가 채움)
  opponent_stats?: {
    rank: number;
    points: number;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goals_for: number;
    goals_against: number;
    recent_form: FormItem[];
  };
}

export interface TeamSchedule {
  last?: TeamMatchResult;
  next?: TeamMatchUpcoming;
}

export interface ScheduleResponse {
  season: number;
  updated_at: string;
  schedule: Record<string, TeamSchedule>;  // team_id → schedule
}

// ─── 코리안 리거 ──────────────────────────────
export interface KoreanPlayer {
  player_id: string;
  player_name: string;
  player_name_ko: string;
  position: string;
  jersey: string;
  age: number | null;
  photo: string;
  team_id: string;
  team_name: string;
  team_short: string;
  team_logo: string;
  appearances: number | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  shots_on_target: number | null;
  minutes: number | null;
}

export interface KoreansResponse {
  season: number;
  updated_at: string;
  players: KoreanPlayer[];
}

// ─── 메타 ──────────────────────────────
export interface Meta {
  season: number;
  league_name: string;
  league_abbr: string;
  league_name_ko: string;
  updated_at: string;
  source: string;
  version: string;
}

// ─── API 함수들 ──────────────────────────────

/**
 * standings 응답에 recent_form 같은 신규 필드가 빠져있으면 fallback에서 보충
 * (구 버전 스크래퍼가 만든 데이터 호환용)
 */
function enrichStandings(data: StandingsResponse): StandingsResponse {
  const fillForm = (rows: MLSTeamStanding[], fallbackRows: MLSTeamStanding[]) =>
    rows.map((row) => {
      if (row.recent_form && row.recent_form.length > 0) return row;
      const fb = fallbackRows.find((f) => f.team_id === row.team_id);
      return fb?.recent_form && fb.recent_form.length > 0
        ? { ...row, recent_form: fb.recent_form }
        : row;
    });
  return {
    ...data,
    eastern: fillForm(data.eastern, FALLBACK_STANDINGS.eastern),
    western: fillForm(data.western, FALLBACK_STANDINGS.western),
  };
}

export const api = {
  standings: async () => {
    const data = await fetchJsonWithRetry<StandingsResponse>(
      'data/standings.json',
      FALLBACK_STANDINGS
    );
    // 빈 응답 안전망: 양 컨퍼런스 모두 비어있으면 fallback 사용
    const enriched = enrichStandings(data);
    if (!enriched.eastern?.length && !enriched.western?.length) {
      return FALLBACK_STANDINGS;
    }
    return enriched;
  },
  son: async () => {
    const data = await fetchJsonWithRetry<SonResponse>('data/son.json', FALLBACK_SON);
    // 빈 응답 안전망: 손흥민 정보가 비어있으면 fallback 사용
    if (!data.son || !data.lafc) return FALLBACK_SON;
    // 시즌 스탯이 비어있으면 fallback에서 보충
    // (스크래퍼가 son.json은 만들었지만 ESPN이 스탯을 안 줘서 0/undefined인 경우)
    const sonHasStats =
      (data.son.appearances ?? 0) > 0 ||
      (data.son.goals ?? 0) > 0 ||
      (data.son.assists ?? 0) > 0;
    if (!sonHasStats) {
      data.son = {
        ...FALLBACK_SON.son,
        // 스크래퍼가 채운 기본 정보는 우선 (player_name, photo 등)
        player_name: data.son.player_name || FALLBACK_SON.son.player_name,
        player_name_ko: data.son.player_name_ko || FALLBACK_SON.son.player_name_ko,
        photo: data.son.photo || FALLBACK_SON.son.photo,
        jersey: data.son.jersey || FALLBACK_SON.son.jersey,
        age: data.son.age || FALLBACK_SON.son.age,
      };
    }
    // 지난/다음 경기가 비어있으면 fallback에서 보충
    if (!data.last_match && FALLBACK_SON.last_match) {
      data.last_match = FALLBACK_SON.last_match;
    }
    if (!data.next_match && FALLBACK_SON.next_match) {
      data.next_match = FALLBACK_SON.next_match;
    }
    return data;
  },
  meta: () =>
    fetchJsonWithRetry<Meta>('data/meta.json', FALLBACK_META),
  scorers: async () => {
    const data = await fetchJsonWithRetry<ScorersResponse>(
      'data/scorers.json',
      FALLBACK_SCORERS
    );
    // 빈 응답 안전망: 득점왕/도움왕 둘 다 비어있으면 fallback 사용
    if (!data.scorers?.length && !data.assisters?.length) {
      return FALLBACK_SCORERS;
    }
    // 부분 비어있을 때 보완
    return {
      ...data,
      scorers: data.scorers?.length ? data.scorers : FALLBACK_SCORERS.scorers,
      assisters: data.assisters?.length ? data.assisters : FALLBACK_SCORERS.assisters,
    };
  },
  schedule: async () => {
    const data = await fetchJsonWithRetry<ScheduleResponse>(
      'data/schedule.json',
      FALLBACK_SCHEDULE
    );
    // 빈 응답 안전망: 일정 객체가 비어있으면 fallback 사용
    if (!data.schedule || Object.keys(data.schedule).length === 0) {
      return FALLBACK_SCHEDULE;
    }
    return data;
  },
  koreans: async () => {
    const data = await fetchJsonWithRetry<KoreansResponse>(
      'data/koreans.json',
      FALLBACK_KOREANS
    );
    // 빈 응답 안전망: 코리안 리거 리스트가 비어있으면 fallback 사용
    if (!data.players?.length) {
      return FALLBACK_KOREANS;
    }
    // 시즌 스탯이 전부 0인 선수는 fallback에서 같은 player_id 또는 이름 매칭으로 보충
    const enrichedPlayers = data.players.map((p) => {
      const hasStats =
        (p.appearances ?? 0) > 0 || (p.goals ?? 0) > 0 || (p.assists ?? 0) > 0;
      if (hasStats) return p;
      const fb = FALLBACK_KOREANS.players.find(
        (f) =>
          f.player_id === p.player_id ||
          f.player_name_ko === p.player_name_ko ||
          f.player_name === p.player_name
      );
      if (!fb) return p;
      return {
        ...p,
        appearances: fb.appearances,
        goals: fb.goals,
        assists: fb.assists,
        shots: fb.shots,
        shots_on_target: fb.shots_on_target,
        minutes: fb.minutes,
      };
    });
    return { ...data, players: enrichedPlayers };
  },
};

/**
 * 컨퍼런스별 standings 추출 헬퍼
 */
export function getStandingsByConference(
  data: StandingsResponse,
  conference: Conference
): MLSTeamStanding[] {
  return conference === 'eastern' ? data.eastern : data.western;
}
