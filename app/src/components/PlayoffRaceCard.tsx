/**
 * 🔥 MLS 컵 플레이오프 진출 경쟁 카드 (2026-10-19)
 * - 컨퍼런스별 확정 / 경쟁 중 / 탈락, LAFC(손흥민) 현황은 무료
 * - 팀별 "자력 진출까지 필요한 승점"은
 *   [광고 보고 진출 조건 보기] → "짧은 광고를 볼까요?" → [광고 보기]를 눌러야만 광고가 나와요.
 *   끝까지 보면 오늘 하루 열려요. 광고를 불러올 수 없으면 그냥 열어 줘요.
 */
import { useEffect, useMemo, useState } from 'react';
import type { MLSTeamStanding } from '@/utils/api';
import { computePlayoffRace, PLAYOFF_SPOTS, DIRECT_SPOTS, type RaceRow } from '@/utils/playoffRace';
import { getTeamByTeamId, type Conference } from '@/data/teams';
import { ConfirmSheet } from '@/components/BottomSheet';
import RewardedAd, { preloadReportAd } from '@/components/RewardedAd';
import { logEvent } from '@/utils/tossGrowth';

const LAFC_ID = '18966';
const unlockKey = () => `mls-race-unlock-${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)}`;
const readUnlock = () => {
  try {
    return localStorage.getItem(unlockKey()) === '1';
  } catch {
    return false;
  }
};
const nameOf = (r: MLSTeamStanding) => getTeamByTeamId(r.team_id)?.name ?? r.team_short_name;

export default function PlayoffRaceCard({ standings, conference, favorite }: { standings: MLSTeamStanding[]; conference: Conference; favorite: string | null }) {
  const [unlocked, setUnlocked] = useState(readUnlock);
  const [ask, setAsk] = useState(false);
  const [adShown, setAdShown] = useState(false);
  const race = useMemo(() => computePlayoffRace(standings), [standings]);
  const done = race.every((r) => r.remaining === 0);

  useEffect(() => {
    if (!done && !unlocked) preloadReportAd();
  }, [done, unlocked]);

  if (race.length < 10 || done) return null;

  const by = (s: RaceRow['status']) => race.filter((r) => r.status === s);
  const alive = by('alive');
  const inRows = by('in');
  const lafc = race.find((r) => r.row.team_id === LAFC_ID);
  const fav = favorite ? race.find((r) => nameOf(r.row) === favorite) : undefined;
  const maxLeft = Math.max(...race.map((r) => r.remaining));
  const minLeft = Math.min(...race.map((r) => r.remaining));
  // 팀마다 치른 경기 수가 달라요 (예: 신시내티 28경기, 대부분 30~31경기). 34경기에서 뺀 값이에요.
  const leftText = minLeft === maxLeft ? `팀당 남은 ${maxLeft}경기` : `팀마다 남은 ${minLeft}~${maxLeft}경기`;
  const focus = [...new Map([...(fav ? [fav] : []), ...(lafc ? [lafc] : []), ...alive].map((r) => [r.row.team_id, r])).values()];

  return (
    <div className="rounded-2xl overflow-hidden bg-white">
      <div className="px-4 pt-4 pb-3" style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #7C3AED 100%)' }}>
        <p className="text-white/90 text-[12px] font-semibold">
          {conference === 'eastern' ? '동부' : '서부'} · {leftText} · 11월 7일 마지막 경기
        </p>
        <p className="text-white text-[18px] font-bold mt-0.5">🔥 플레이오프 남은 {Math.max(0, PLAYOFF_SPOTS - inRows.length)}자리</p>
      </div>
      <div className="p-4 space-y-2.5">
        <Row label="진출 확정" color="#3182F6" items={inRows.map((r) => `${nameOf(r.row)}${r.directClinched ? '(직행)' : ''}`)} />
        <Row label="경쟁 중" color="#F04452" items={alive.map((r) => `${nameOf(r.row)} ${r.row.points}점`)} />
        <Row label="탈락" color="#8B95A1" items={by('out').map((r) => nameOf(r.row))} />

        {lafc && (
          <div className="rounded-xl bg-toss-gray-50 p-3 text-[14px] text-toss-gray-900">
            <b>⚽ LAFC (손흥민)</b> 서부 {lafc.row.rank}위 · {lafc.row.points}점 · 남은 {lafc.remaining}경기 ·{' '}
            <b style={{ color: lafc.status === 'in' ? '#3182F6' : lafc.status === 'out' ? '#8B95A1' : '#F04452' }}>
              {lafc.status === 'in' ? '진출 확정' : lafc.status === 'out' ? '탈락' : '경쟁 중'}
            </b>
          </div>
        )}

        {unlocked ? (
          <div className="space-y-2 pt-1">
            {focus.map((r) => (
              <NeedRow key={r.row.team_id} r={r} />
            ))}
            <p className="text-[12px] text-toss-gray-500 leading-relaxed">
              {PLAYOFF_SPOTS}위까지 진출, {DIRECT_SPOTS}위까지 1라운드 직행 (8~9위는 와일드카드). 다른 팀이 남은 경기를 다 이긴다고 쳐도
              확정되는 승점이에요. 승점이 같을 때의 순위 기준은 따지지 않았어요. 결과를 예측하지 않아요.
            </p>
          </div>
        ) : (
          <div className="relative rounded-xl border border-toss-gray-100 p-3">
            <div className="space-y-2 blur-sm select-none pointer-events-none" aria-hidden>
              <div className="h-10 rounded-lg bg-toss-gray-100" />
              <div className="h-10 rounded-lg bg-toss-gray-100" />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
              <p className="text-[13px] font-semibold text-toss-gray-800">팀별로 승점 몇 점이면 자력 진출인지</p>
              <button
                type="button"
                onClick={() => setAsk(true)}
                className="mt-2 w-full max-w-[260px] rounded-xl bg-toss-blue py-3 text-[15px] font-bold text-white"
              >
                광고 보고 진출 조건 보기
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmSheet
        open={ask}
        desc={'짧은 광고를 끝까지 보면\n오늘 하루 팀별 진출 조건을 볼 수 있어요.'}
        onClose={() => setAsk(false)}
        onConfirm={() => {
          setAsk(false);
          setAdShown(true);
        }}
      />
      {adShown && (
        <RewardedAd
          onReward={() => {
            try {
              localStorage.setItem(unlockKey(), '1');
            } catch {
              /* noop */
            }
            setUnlocked(true);
            logEvent('playoff_race_unlocked', { conference });
          }}
          onClose={() => setAdShown(false)}
        />
      )}
    </div>
  );
}

function Row({ label, color, items }: { label: string; color: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0 w-[62px] text-[12px] font-bold pt-0.5" style={{ color }}>
        {label}
      </span>
      <span className="text-[14px] text-toss-gray-800 leading-relaxed">{items.join(' · ')}</span>
    </div>
  );
}

function need(n: number | null, remaining: number) {
  if (n === null) return '자력으로는 어려워요 · 다른 팀 결과 필요';
  if (n === 0) return '확정';
  return `승점 ${n}점 더 (남은 ${remaining}경기에서)`;
}

function NeedRow({ r }: { r: RaceRow }) {
  const info = getTeamByTeamId(r.row.team_id);
  return (
    <div className="rounded-xl border border-toss-gray-100 p-3">
      <p className="font-bold text-[15px]" style={{ color: info?.color && info.color !== '#FFD700' ? info.color : '#191F28' }}>
        {nameOf(r.row)} <span className="text-toss-gray-500 text-[12px] font-medium">{r.row.rank}위 · {r.row.points}점 · 남은 {r.remaining}경기</span>
      </p>
      {r.status === 'out' ? (
        <p className="text-[14px] text-toss-gray-500 mt-1">남은 경기를 다 이겨도 9위 안에 들 수 없어요</p>
      ) : (
        <>
          <p className="text-[14px] mt-1">
            <span className="text-toss-gray-600">플레이오프 </span>
            <b className="text-toss-gray-900">{need(r.needForPlayoff, r.remaining)}</b>
          </p>
          <p className="text-[14px] mt-0.5">
            <span className="text-toss-gray-600">1라운드 직행 </span>
            <b className="text-toss-gray-900">{need(r.needForDirect, r.remaining)}</b>
          </p>
        </>
      )}
    </div>
  );
}
