import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Settings, RefreshCw, Calendar, MapPin, Clock } from 'lucide-react';
import {
  api,
  type StandingsResponse,
  type MLSTeamStanding,
  type Meta,
  type ScheduleResponse,
  type FormItem,
  getStandingsByConference,
} from '@/utils/api';
import { getFavoriteTeam, setFavoriteTeam } from '@/utils/storage';
import { getTeam, getTeamByTeamId, type Conference } from '@/data/teams';
import BannerAd from '@/components/BannerAd';
import FavoriteTeamModal from '@/components/FavoriteTeamModal';
import TeamLogo from '@/components/TeamLogo';

interface Props {
  conference: Conference;
}

export default function StandingsPage({ conference }: Props) {
  const navigate = useNavigate();
  const [data, setData] = useState<StandingsResponse | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState<string | null>(getFavoriteTeam());
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, m, sch] = await Promise.all([
        api.standings(),
        api.meta().catch(() => null),
        api.schedule().catch(() => null),
      ]);
      setData(s);
      setMeta(m);
      setSchedule(sch);
    } catch (e: any) {
      setError(e.message || '로딩 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFavoriteSelect = (team: string | null) => {
    setFavorite(team);
    setFavoriteTeam(team);
  };

  // 컨퍼런스별 standings 추출
  const standings: MLSTeamStanding[] = data ? getStandingsByConference(data, conference) : [];

  // 즐겨찾기 팀이 이 컨퍼런스에 있는지
  const favoriteRow = favorite
    ? standings.find((s) => {
        const ti = getTeamByTeamId(s.team_id);
        return ti && ti.name === favorite;
      })
    : undefined;

  // 즐겨찾기 팀 또는 1위 팀의 일정
  const featuredRow = favoriteRow ?? standings[0];
  const featuredSchedule = featuredRow && schedule?.schedule?.[featuredRow.team_id];

  const titleEmoji = conference === 'eastern' ? '🏆' : '🌅';
  const titleText = conference === 'eastern' ? '동부 컨퍼런스' : '서부 컨퍼런스';
  const updatedDate = meta?.updated_at
    ? new Date(meta.updated_at).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
    <div className="min-h-screen bg-toss-gray-50">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 flex items-end justify-between bg-white">
        <div>
          <h1 className="toss-title text-[24px]">{titleEmoji} {titleText}</h1>
          <p className="toss-caption mt-1">
            {updatedDate ? `${updatedDate} 업데이트` : `${meta?.season || 2026} 시즌 MLS`}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <button
            onClick={() => setShowModal(true)}
            className="p-2 rounded-full hover:bg-toss-gray-100"
            aria-label="즐겨찾기 팀 설정"
          >
            {favorite ? (
              <Heart size={18} className="text-toss-red" fill="#FF3B30" />
            ) : (
              <Settings size={18} className="text-toss-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* 즐겨찾기 카드 */}
      {favorite && favoriteRow && (
        <div className="px-5 mb-3 mt-2">
          <FavoriteTeamCard
            teamName={favorite}
            row={favoriteRow}
            onReportClick={() => navigate('/team-report')}
          />
        </div>
      )}

      {/* 다음 경기 카드 (즐겨찾기 팀 또는 1위 팀) */}
      {featuredRow && featuredSchedule?.next && (
        <div className="px-5 mb-3">
          <NextMatchCard
            teamRow={featuredRow}
            next={featuredSchedule.next}
            last={featuredSchedule.last}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-5 mb-3 p-4 bg-toss-red/10 rounded-2xl">
          <p className="text-sm text-toss-red font-medium">
            데이터를 불러올 수 없어요
          </p>
          <p className="text-xs text-toss-gray-600 mt-1">{error}</p>
          <button
            onClick={load}
            className="mt-2 text-xs text-toss-blue font-medium"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* Standings Table */}
      <div className="px-5 pb-2">
        <div className="bg-white rounded-2xl overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[22px_1fr_26px_30px_24px_24px_24px_56px] gap-1 px-3 py-2.5 border-b border-toss-gray-100 text-[10px] font-semibold text-toss-gray-500">
            <span className="text-center">#</span>
            <span>팀</span>
            <span className="text-center">경기</span>
            <span className="text-center">승점</span>
            <span className="text-center">승</span>
            <span className="text-center">무</span>
            <span className="text-center">패</span>
            <span className="text-center">최근</span>
          </div>

          {/* Rows */}
          {standings.map((row) => {
            const teamInfo = getTeamByTeamId(row.team_id);
            const koreanName = teamInfo?.name || row.team_short_name;
            const isFav = favorite === koreanName;
            const color = teamInfo?.color || '#191F28';
            const bgLight = teamInfo?.bgLight || '#F2F4F6';

            // 플레이오프 진출권 (1~9위)
            const isPlayoff = row.rank <= 9;

            return (
              <div
                key={row.team_id}
                className="grid grid-cols-[22px_1fr_26px_30px_24px_24px_24px_56px] gap-1 items-center px-3 py-2.5 border-b border-toss-gray-50 last:border-0"
                style={
                  isFav
                    ? { backgroundColor: bgLight }
                    : undefined
                }
              >
                <span
                  className="text-center font-bold text-sm"
                  style={{
                    color: row.rank <= 3 ? color : isPlayoff ? '#3182F6' : '#191F28',
                  }}
                >
                  {row.rank}
                </span>
                <span className="flex items-center gap-1.5 min-w-0">
                  <TeamLogo team={koreanName} size={20} logoUrl={row.team_logo} />
                  <span
                    className={`text-[12px] truncate ${
                      isFav ? 'font-bold' : 'font-semibold'
                    }`}
                    style={{ color: isFav ? color : '#191F28' }}
                  >
                    {koreanName}
                  </span>
                </span>
                <span className="text-center text-[11px] text-toss-gray-500">
                  {row.played}
                </span>
                <span
                  className="text-center font-extrabold text-sm"
                  style={{ color: '#3182F6' }}
                >
                  {row.points}
                </span>
                <span className="text-center text-[11px] text-toss-gray-700">
                  {row.wins}
                </span>
                <span className="text-center text-[11px] text-toss-gray-700">
                  {row.draws}
                </span>
                <span className="text-center text-[11px] text-toss-gray-700">
                  {row.losses}
                </span>
                {/* 최근 5경기 폼 */}
                <span className="flex items-center justify-center gap-0.5">
                  <FormDots form={row.recent_form ?? []} size={7} />
                </span>
              </div>
            );
          })}

          {standings.length === 0 && !loading && (
            <div className="p-10 text-center text-toss-gray-400 text-sm">
              표시할 데이터가 없어요
            </div>
          )}
        </div>

        {/* 안내 */}
        {standings.length > 0 && (
          <div className="mt-2 px-1 flex items-center gap-3 flex-wrap">
            <p className="text-[11px] text-toss-gray-400 leading-relaxed">
              승점 = 승 3점 + 무 1점. 1~9위 플레이오프 진출.
            </p>
            <div className="flex items-center gap-2 text-[10px] text-toss-gray-500">
              <FormLegendDot color="#0CB46E" label="승" />
              <FormLegendDot color="#8B95A1" label="무" />
              <FormLegendDot color="#FF6B35" label="패" />
            </div>
          </div>
        )}

        {/* 하단 배너 광고 */}
        {!loading && (
          <div className="mt-4">
            <BannerAd />
          </div>
        )}
      </div>

      {showModal && (
        <FavoriteTeamModal
          currentTeam={favorite}
          onClose={() => setShowModal(false)}
          onSelect={handleFavoriteSelect}
        />
      )}
    </div>
  );
}

// ─── 즐겨찾기 팀 카드 ───
function FavoriteTeamCard({
  teamName,
  row,
  onReportClick,
}: {
  teamName: string;
  row: MLSTeamStanding;
  onReportClick: () => void;
}) {
  const info = getTeam(teamName);
  return (
    <div
      className="rounded-2xl p-4"
      style={{ backgroundColor: info.bgLight }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <TeamLogo team={teamName} size={36} logoUrl={row.team_logo} />
          <div className="min-w-0">
            <p
              className="font-bold text-sm truncate"
              style={{ color: info.color }}
            >
              {info.fullName}
            </p>
            <p className="text-[11px] text-toss-gray-600 mt-0.5">
              {row.rank}위 · {row.played}경기 · 득실 {row.goal_diff_display}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p
            className="text-2xl font-extrabold leading-tight"
            style={{ color: info.color }}
          >
            {row.points}
          </p>
          <p className="text-[10px] text-toss-gray-500">승점</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 mt-3">
        <Stat label="승" value={row.wins} color={info.color} />
        <Stat label="무" value={row.draws} color={info.color} />
        <Stat label="패" value={row.losses} color={info.color} />
        <Stat
          label="득점"
          value={row.goals_for}
          color={info.color}
        />
      </div>

      {/* 최근 5경기 폼 */}
      {row.recent_form && row.recent_form.length > 0 && (
        <div className="mt-3 bg-white/70 rounded-xl px-3 py-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-toss-gray-700">
              최근 5경기
            </p>
            <FormDots form={row.recent_form} size={12} />
          </div>
        </div>
      )}

      {/* 상세 분석 리포트 진입 버튼 */}
      <button
        onClick={onReportClick}
        className="w-full mt-3 py-2.5 rounded-xl font-bold text-white text-sm shadow-sm active:scale-[0.98] transition-transform"
        style={{ backgroundColor: info.color }}
      >
        📊 상세 분석 리포트 보기
      </button>
    </div>
  );
}

// ─── 다음 경기 카드 ───
function NextMatchCard({
  teamRow,
  next,
  last,
}: {
  teamRow: MLSTeamStanding;
  next: NonNullable<ScheduleResponse['schedule'][string]>['next'];
  last?: NonNullable<ScheduleResponse['schedule'][string]>['last'];
}) {
  const teamInfo = getTeamByTeamId(teamRow.team_id);
  const teamName = teamInfo?.name || teamRow.team_short_name;
  const color = teamInfo?.color || '#191F28';

  if (!next) return null;

  return (
    <div className="bg-white rounded-2xl p-4 border border-toss-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={14} className="text-toss-blue" />
        <p className="text-xs font-bold text-toss-gray-700">
          {teamName} 경기 일정
        </p>
      </div>

      {/* 다음 경기 */}
      <div
        className="rounded-xl p-3"
        style={{
          backgroundColor: `${color}10`,
          border: `1px solid ${color}25`,
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color }}
          >
            ⚽ 다음 경기
          </span>
          {next.days_until !== undefined && next.days_until !== null && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: color }}
            >
              D-{next.days_until}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-toss-gray-900 truncate">
              {next.home ? 'vs' : '@'} {next.opponent_name}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <MapPin size={11} className="text-toss-gray-400" />
              <span className="text-[11px] text-toss-gray-500">
                {next.home ? '홈' : '원정'} · {next.venue || ''}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/50">
          <Clock size={12} style={{ color }} />
          <span className="text-xs font-bold" style={{ color }}>
            🇰🇷 한국시간 {next.kst_display}
          </span>
        </div>
      </div>

      {/* 지난 경기 결과 */}
      {last && (
        <div className="mt-2 bg-toss-gray-50 rounded-xl p-3">
          <p className="text-[10px] font-bold text-toss-gray-500 uppercase tracking-wider mb-1.5">
            🕓 지난 경기
          </p>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-toss-gray-700">
              {last.home ? 'vs' : '@'} {last.opponent_name}
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  last.result === 'W'
                    ? 'bg-toss-green/10 text-toss-green'
                    : last.result === 'L'
                    ? 'bg-toss-red/10 text-toss-red'
                    : 'bg-toss-gray-200 text-toss-gray-600'
                }`}
              >
                {last.result === 'W' ? '승' : last.result === 'L' ? '패' : '무'}
              </span>
              <span className="text-sm font-extrabold text-toss-gray-900">
                {last.home_score}-{last.away_score}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 폼 도트 ───
function FormDots({ form, size = 8 }: { form: FormItem[]; size?: number }) {
  if (!form || form.length === 0) {
    return (
      <span className="text-[10px] text-toss-gray-300">-</span>
    );
  }

  return (
    <span className="flex items-center gap-0.5">
      {form.slice(-5).map((item, i) => {
        const color =
          item === 'W'
            ? '#0CB46E'
            : item === 'L'
            ? '#FF6B35'
            : '#8B95A1';
        return (
          <span
            key={i}
            className="rounded-full shrink-0"
            style={{
              width: size,
              height: size,
              backgroundColor: color,
            }}
            title={item === 'W' ? '승' : item === 'L' ? '패' : '무'}
          />
        );
      })}
    </span>
  );
}

function FormLegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="rounded-full inline-block"
        style={{ width: 8, height: 8, backgroundColor: color }}
      />
      <span>{label}</span>
    </span>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="text-center bg-white/70 rounded-xl py-2">
      <p className="text-[10px] text-toss-gray-500">{label}</p>
      <p
        className="text-sm font-extrabold mt-0.5"
        style={{ color }}
      >
        {value}
      </p>
    </div>
  );
}
