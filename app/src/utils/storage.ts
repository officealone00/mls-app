/**
 * 즐겨찾기 팀 & 설정 관리 (localStorage)
 * MLS 앱 전용 (mls- 접두사)
 */

import type { Conference } from '@/data/teams';

const KEYS = {
  favoriteTeam: 'mls-favorite-team',
  conference: 'mls-conference',  // 마지막으로 본 컨퍼런스
  hasOnboarded: 'mls-has-onboarded',
  interstitialCount: 'mls-interstitial-count',
};

export function getFavoriteTeam(): string | null {
  try {
    return localStorage.getItem(KEYS.favoriteTeam);
  } catch {
    return null;
  }
}

export function setFavoriteTeam(team: string | null): void {
  try {
    if (team) localStorage.setItem(KEYS.favoriteTeam, team);
    else localStorage.removeItem(KEYS.favoriteTeam);
  } catch {}
}

export function getSavedConference(): Conference {
  try {
    const v = localStorage.getItem(KEYS.conference);
    return v === 'western' ? 'western' : 'eastern';
  } catch {
    return 'eastern';
  }
}

export function setSavedConference(c: Conference): void {
  try {
    localStorage.setItem(KEYS.conference, c);
  } catch {}
}

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(KEYS.hasOnboarded) === '1';
  } catch {
    return false;
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(KEYS.hasOnboarded, '1');
  } catch {}
}

// ─── 전면광고 카운터 (N번에 1회 표시) ───
export function getInterstitialCount(): number {
  try {
    return parseInt(localStorage.getItem(KEYS.interstitialCount) || '0', 10);
  } catch {
    return 0;
  }
}

export function incrementInterstitialCount(): number {
  const n = getInterstitialCount() + 1;
  try {
    localStorage.setItem(KEYS.interstitialCount, String(n));
  } catch {}
  return n;
}

export function resetInterstitialCount(): void {
  try {
    localStorage.setItem(KEYS.interstitialCount, '0');
  } catch {}
}
