import { useEffect, useState } from 'react';
import { RefreshCw, Trophy, Sparkles } from 'lucide-react';
import { api, type ScorersResponse, type ScorerEntry, type AssisterEntry } from '@/utils/api';
import BannerAd from '@/components/BannerAd';
import TeamLogo from '@/components/TeamLogo';

type Tab = 'scorers' | 'assisters';

export default function ScorersPage() {
  const [data, setData] = useState<ScorersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('scorers');

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.scorers();
      setData(d);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const scorers = data?.scorers || [];
  const assisters = data?.assisters || [];

  // 손흥민 강조용
  const sonScorer = scorers.find((s) => s.player_id === '178194');
  const sonAssister = assisters.find((a) => a.player_id === '178194');

  return (
    <div className="min-h-screen bg-toss-gray-50">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 bg-white flex items-end justify-between">
        <div>
          <h1 className="toss-title text-[24px]">⚽ MLS 득점왕</h1>
          <p className="toss-caption mt-1">2026 시즌 골 · 도움 순위</p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-full hover:bg-toss-gray-100"
          aria-label="새로고침"
        >
          <RefreshCw
            size={18}
            className={`text-toss-gray-600 ${loading ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* 손흥민 하이라이트 카드 */}
      {(sonScorer || sonAssister) && (
        <div className="px-5 mt-2">
          <div
            className="rounded-2xl p-4 text-white"
            style={{
              background: 'linear-gradient(135deg, #000 0%, #1a1a1a 50%, #FFC72C 220%)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} color="#FFD700" />
              <span className="text-[12px] font-bold" style={{ color: '#FFD700' }}>
                손흥민 시즌 랭킹
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[11px] text-white/70">득점 랭킹</p>
                <p className="text-2xl font-extrabold" style={{ color: '#FFD700' }}>
                  {sonScorer ? `${sonScorer.rank}위` : '-'}
                </p>
                <p className="text-[11px] text-white/80 mt-0.5">
                  {sonScorer ? `${sonScorer.goals}골` : '데이터 없음'}
                </p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[11px] text-white/70">도움 랭킹</p>
                <p className="text-2xl font-extrabold" style={{ color: '#FFD700' }}>
                  {sonAssister ? `${sonAssister.rank}위` : '-'}
                </p>
                <p className="text-[11px] text-white/80 mt-0.5">
                  {sonAssister ? `${sonAssister.assists}어시` : '데이터 없음'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 탭 토글 */}
      <div className="px-5 mt-3">
        <div className="bg-white rounded-2xl p-1 flex">
          <TabButton
            active={tab === 'scorers'}
            onClick={() => setTab('scorers')}
            label="⚽ 득점왕"
          />
          <TabButton
            active={tab === 'assisters'}
            onClick={() => setTab('assisters')}
            label="🎯 도움왕"
          />
        </div>
      </div>

      {/* 순위 리스트 */}
      <div className="px-5 mt-3 pb-4">
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[28px_1fr_36px_36px] gap-2 px-3 py-2.5 border-b border-toss-gray-100 text-[11px] font-semibold text-toss-gray-500">
            <span className="text-center">#</span>
            <span>선수 · 팀</span>
            <span className="text-center">{tab === 'scorers' ? '골' : '도움'}</span>
            <span className="text-center">경기</span>
          </div>

          {tab === 'scorers' &&
            scorers.map((p) => <ScorerRow key={p.player_id} player={p} />)}

          {tab === 'assisters' &&
            assisters.map((p) => <AssisterRow key={p.player_id} player={p} />)}

          {!loading &&
            ((tab === 'scorers' && scorers.length === 0) ||
              (tab === 'assisters' && assisters.length === 0)) && (
              <div className="p-10 text-center text-toss-gray-400 text-sm">
                표시할 데이터가 없어요
              </div>
            )}
        </div>

        {/* 하단 안내 */}
        <p className="text-[11px] text-toss-gray-400 mt-2 px-1 leading-relaxed">
          매일 새벽 자동 업데이트 · ESPN 공개 데이터 기반
        </p>

        <div className="mt-4">
          <BannerAd />
        </div>
      </div>
    </div>
  );
}

// ─── 컴포넌트들 ───
function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-colors ${
        active
          ? 'bg-toss-blue text-white'
          : 'text-toss-gray-600'
      }`}
      style={active ? { backgroundColor: '#3182F6' } : undefined}
    >
      {label}
    </button>
  );
}

function ScorerRow({ player }: { player: ScorerEntry }) {
  const isSon = player.player_id === '178194';
  return (
    <div
      className="grid grid-cols-[28px_1fr_36px_36px] gap-2 items-center px-3 py-2.5 border-b border-toss-gray-50 last:border-0"
      style={isSon ? { backgroundColor: '#FFF8D6' } : undefined}
    >
      <span
        className="text-center font-bold text-sm"
        style={{
          color: player.rank === 1 ? '#FFD700' : player.rank <= 3 ? '#FF6B35' : isSon ? '#000' : '#191F28',
        }}
      >
        {player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : player.rank === 3 ? '🥉' : player.rank}
      </span>
      <div className="flex items-center gap-2 min-w-0">
        <TeamLogo team={player.team_short} size={22} logoUrl={player.team_logo} />
        <div className="min-w-0">
          <p
            className={`text-[13px] truncate ${isSon ? 'font-extrabold' : 'font-semibold'}`}
            style={isSon ? { color: '#000' } : undefined}
          >
            {player.player_name_ko}
            {isSon && <span className="ml-1 text-[10px]">🇰🇷</span>}
          </p>
          <p className="text-[10px] text-toss-gray-500 truncate">
            {player.team_short}
          </p>
        </div>
      </div>
      <span
        className="text-center font-extrabold text-base"
        style={{ color: isSon ? '#000' : '#3182F6' }}
      >
        {player.goals}
      </span>
      <span className="text-center text-xs text-toss-gray-500">{player.played}</span>
    </div>
  );
}

function AssisterRow({ player }: { player: AssisterEntry }) {
  const isSon = player.player_id === '178194';
  return (
    <div
      className="grid grid-cols-[28px_1fr_36px_36px] gap-2 items-center px-3 py-2.5 border-b border-toss-gray-50 last:border-0"
      style={isSon ? { backgroundColor: '#FFF8D6' } : undefined}
    >
      <span
        className="text-center font-bold text-sm"
        style={{
          color: player.rank === 1 ? '#FFD700' : player.rank <= 3 ? '#FF6B35' : isSon ? '#000' : '#191F28',
        }}
      >
        {player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : player.rank === 3 ? '🥉' : player.rank}
      </span>
      <div className="flex items-center gap-2 min-w-0">
        <TeamLogo team={player.team_short} size={22} logoUrl={player.team_logo} />
        <div className="min-w-0">
          <p
            className={`text-[13px] truncate ${isSon ? 'font-extrabold' : 'font-semibold'}`}
            style={isSon ? { color: '#000' } : undefined}
          >
            {player.player_name_ko}
            {isSon && <span className="ml-1 text-[10px]">🇰🇷</span>}
          </p>
          <p className="text-[10px] text-toss-gray-500 truncate">
            {player.team_short}
          </p>
        </div>
      </div>
      <span
        className="text-center font-extrabold text-base"
        style={{ color: isSon ? '#000' : '#3182F6' }}
      >
        {player.assists}
      </span>
      <span className="text-center text-xs text-toss-gray-500">{player.played}</span>
    </div>
  );
}
