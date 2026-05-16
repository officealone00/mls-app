import { useEffect, useState } from 'react';
import {
  RefreshCw,
  TrendingUp,
  MapPin,
  Calendar,
  Clock,
  Target,
  Award,
  Activity,
} from 'lucide-react';
import {
  api,
  type SonResponse,
  type StandingsResponse,
  type FormItem,
  type KoreansResponse,
} from '@/utils/api';
import { LAFC_TEAM_NAME, getTeam, getTeamByTeamId } from '@/data/teams';
import BannerAd from '@/components/BannerAd';
import TeamLogo from '@/components/TeamLogo';

export default function SonPage() {
  const [son, setSon] = useState<SonResponse | null>(null);
  const [standings, setStandings] = useState<StandingsResponse | null>(null);
  const [koreans, setKoreans] = useState<KoreansResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, st, kr] = await Promise.all([
        api.son(),
        api.standings().catch(() => null),
        api.koreans().catch(() => null),
      ]);
      setSon(s);
      setStandings(st);
      setKoreans(kr);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const lafcInfo = getTeam(LAFC_TEAM_NAME);
  const westStandings = standings?.western || [];
  const lafcRow = westStandings.find((s) => s.team_id === '18966');

  // 컨퍼런스 평균 비교
  const avgPoints =
    westStandings.length > 0
      ? westStandings.reduce((sum, t) => sum + t.points, 0) / westStandings.length
      : 0;
  const lafcPoints = lafcRow?.points || son?.lafc.points || 0;
  const aboveAvg = lafcPoints - avgPoints;

  return (
    <div className="min-h-screen bg-toss-gray-50">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 bg-white flex items-center justify-between">
        <div>
          <h1 className="toss-title text-[24px]">⭐ 손흥민 트래커</h1>
          <p className="toss-caption mt-1">LAFC · 2026 시즌</p>
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

      {/* 손흥민 카드 */}
      {son && (
        <div className="px-5 mt-2">
          <div
            className="rounded-2xl p-5 text-white relative overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #FFC72C 200%)',
            }}
          >
            <div className="flex items-start gap-4 relative z-10">
              <div
                className="rounded-2xl overflow-hidden flex-shrink-0 bg-white/10 flex items-center justify-center"
                style={{ width: 96, height: 96 }}
              >
                {!imageError && son.son.photo ? (
                  <img
                    src={son.son.photo}
                    alt={son.son.player_name_ko}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <span style={{ fontSize: 48 }}>🇰🇷</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-extrabold leading-tight">
                    {son.son.player_name_ko}
                  </h2>
                  <span className="text-base">🇰🇷</span>
                </div>
                <p className="text-[12px] text-white/80 mt-0.5">
                  {son.son.player_name}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-white/15 text-[11px] font-semibold">
                    #{son.son.jersey}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white/15 text-[11px] font-semibold">
                    {son.son.position_ko}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white/15 text-[11px] font-semibold">
                    {son.son.age}세
                  </span>
                </div>
                <p className="text-[11px] text-white/70 mt-2 leading-relaxed">
                  {son.son.transfer_note}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 손흥민 시즌 스탯 (골/어시스트/리그 순위) */}
      {son?.son?.goals !== undefined && (
        <div className="px-5 mt-3">
          <div
            className="rounded-2xl p-4"
            style={{ backgroundColor: '#FFF8D6', borderWidth: 1, borderStyle: 'solid', borderColor: '#FFD700' }}
          >
            <h3 className="text-sm font-bold text-black mb-3 flex items-center gap-1.5">
              <Award size={16} color="#FFC72C" />
              2026 시즌 스탯
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <SonBigStat
                label="골"
                value={son.son.goals ?? 0}
                sub={
                  son.son.league_goal_rank
                    ? `리그 ${son.son.league_goal_rank}위`
                    : undefined
                }
                color="#000"
              />
              <SonBigStat
                label="어시스트"
                value={son.son.assists ?? 0}
                sub={
                  son.son.league_assist_rank
                    ? `리그 ${son.son.league_assist_rank}위`
                    : undefined
                }
                color="#000"
              />
              <SonBigStat
                label="공격포인트"
                value={(son.son.goals ?? 0) + (son.son.assists ?? 0)}
                sub={`${son.son.appearances ?? 0}경기`}
                color="#000"
              />
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2">
              <SmallStat label="슈팅" value={son.son.shots ?? 0} />
              <SmallStat label="유효슛" value={son.son.shots_on_target ?? 0} />
              <SmallStat label="출전" value={`${son.son.minutes ?? 0}'`} />
              <SmallStat label="경기당 골" value={(son.son.goals_per_match ?? 0).toFixed(2)} />
            </div>
          </div>
        </div>
      )}

      {/* 지난 경기 - 손흥민 활약 */}
      {son?.last_match && (
        <div className="px-5 mt-3">
          <div className="rounded-2xl bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-toss-gray-900 flex items-center gap-1.5">
                <Activity size={16} className="text-toss-blue" />
                지난 경기
              </h3>
              <span className="text-[11px] text-toss-gray-500">
                {son.last_match.round}
              </span>
            </div>

            {/* 스코어 박스 */}
            <div className="bg-toss-gray-50 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <TeamLogo
                    team={son.last_match.home ? 'LAFC' : son.last_match.opponent_short}
                    size={28}
                    logoUrl={
                      son.last_match.home
                        ? 'https://a.espncdn.com/i/teamlogos/soccer/500/18966.png'
                        : son.last_match.opponent_logo
                    }
                  />
                  <span className="text-[12px] font-bold text-toss-gray-800 truncate">
                    {son.last_match.home ? 'LAFC' : son.last_match.opponent_short}
                  </span>
                </div>
                <div className="px-3 text-center">
                  <p className="text-2xl font-extrabold tabular-nums" style={{ color: '#191F28' }}>
                    {son.last_match.home_score}
                    <span className="text-toss-gray-400 mx-1">:</span>
                    {son.last_match.away_score}
                  </p>
                  <p
                    className="text-[10px] font-bold mt-0.5"
                    style={{
                      color:
                        son.last_match.result === 'W'
                          ? '#0CB46E'
                          : son.last_match.result === 'D'
                          ? '#8B95A1'
                          : '#FF6B35',
                    }}
                  >
                    {son.last_match.result === 'W' ? '승' : son.last_match.result === 'D' ? '무' : '패'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <span className="text-[12px] font-bold text-toss-gray-800 truncate">
                    {son.last_match.home ? son.last_match.opponent_short : 'LAFC'}
                  </span>
                  <TeamLogo
                    team={son.last_match.home ? son.last_match.opponent_short : 'LAFC'}
                    size={28}
                    logoUrl={
                      son.last_match.home
                        ? son.last_match.opponent_logo
                        : 'https://a.espncdn.com/i/teamlogos/soccer/500/18966.png'
                    }
                  />
                </div>
              </div>
              <p className="text-[10px] text-toss-gray-500 mt-2 text-center flex items-center justify-center gap-1">
                <MapPin size={10} />
                {son.last_match.venue} · {son.last_match.kst_display || ''}
              </p>
            </div>

            {/* 손흥민 경기 활약 */}
            {son.last_match.son_played && (
              <div
                className="mt-3 rounded-xl p-3"
                style={{ background: 'linear-gradient(135deg, #FFF8D6, #FFEBA0)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">🇰🇷</span>
                  <p className="text-[12px] font-extrabold text-black">
                    손흥민 경기 활약
                  </p>
                  {son.last_match.son_man_of_the_match && (
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-md bg-black text-white">
                      MOTM ⭐
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <MatchStat label="골" value={son.last_match.son_goals} highlight={son.last_match.son_goals > 0} />
                  <MatchStat label="도움" value={son.last_match.son_assists} highlight={son.last_match.son_assists > 0} />
                  <MatchStat label="슈팅" value={son.last_match.son_shots ?? 0} />
                  <MatchStat label="출전" value={`${son.last_match.son_minutes}'`} />
                </div>
                {son.last_match.son_rating !== undefined && (
                  <div className="mt-2 flex items-center justify-between bg-black/5 rounded-lg px-3 py-1.5">
                    <span className="text-[11px] text-black/70">매치 평점</span>
                    <span className="text-sm font-extrabold text-black">
                      {son.last_match.son_rating.toFixed(1)} / 10
                    </span>
                  </div>
                )}
                {son.last_match.summary && (
                  <p className="text-[11px] text-black/80 mt-2 leading-relaxed">
                    💬 {son.last_match.summary}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 다음 경기 - 한국시간 */}
      {son?.next_match && (
        <div className="px-5 mt-3">
          <div
            className="rounded-2xl p-4"
            style={{
              background: 'linear-gradient(135deg, #F0F6FF 0%, #DCE9FF 100%)',
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: '#B5D0FF',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-toss-gray-900 flex items-center gap-1.5">
                <Calendar size={16} className="text-toss-blue" />
                다음 경기
              </h3>
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                style={{ backgroundColor: '#3182F6', color: '#fff' }}
              >
                D-{son.next_match.days_until}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <TeamLogo
                  team={son.next_match.home ? 'LAFC' : son.next_match.opponent_short}
                  size={36}
                  logoUrl={
                    son.next_match.home
                      ? 'https://a.espncdn.com/i/teamlogos/soccer/500/18966.png'
                      : son.next_match.opponent_logo
                  }
                />
                <span className="text-[13px] font-bold text-toss-gray-800 truncate">
                  {son.next_match.home ? 'LAFC' : son.next_match.opponent_short}
                </span>
              </div>
              <span className="text-toss-gray-400 font-bold text-sm mx-2">VS</span>
              <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                <span className="text-[13px] font-bold text-toss-gray-800 truncate">
                  {son.next_match.home ? son.next_match.opponent_short : 'LAFC'}
                </span>
                <TeamLogo
                  team={son.next_match.home ? son.next_match.opponent_short : 'LAFC'}
                  size={36}
                  logoUrl={
                    son.next_match.home
                      ? son.next_match.opponent_logo
                      : 'https://a.espncdn.com/i/teamlogos/soccer/500/18966.png'
                  }
                />
              </div>
            </div>

            {/* 한국시간 표시 */}
            <div className="mt-3 bg-white/70 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-toss-blue" />
                <div className="flex-1">
                  <p className="text-[10px] text-toss-gray-500">킥오프 (한국시간)</p>
                  <p className="text-sm font-extrabold text-toss-gray-900">
                    {son.next_match.kst_display}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <MapPin size={12} className="text-toss-gray-500" />
                <p className="text-[11px] text-toss-gray-600">
                  {son.next_match.venue} · {son.next_match.round}
                </p>
              </div>
            </div>

            {son.next_match.preview && (
              <p className="text-[12px] text-toss-gray-700 mt-3 leading-relaxed">
                📌 {son.next_match.preview}
              </p>
            )}
          </div>
        </div>
      )}

      {/* LAFC 팀 카드 */}
      {son && (
        <div className="px-5 mt-3">
          <div
            className="rounded-2xl p-4"
            style={{
              backgroundColor: '#FFF8D6',
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: '#FFD700',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <TeamLogo team={LAFC_TEAM_NAME} size={42} logoUrl={son.lafc.team_logo} />
                <div className="min-w-0">
                  <p className="font-bold text-base text-black truncate">
                    {son.lafc.team_name}
                  </p>
                  <p className="text-[11px] text-toss-gray-600 mt-0.5 flex items-center gap-1">
                    <MapPin size={10} />
                    {son.lafc.venue}
                  </p>
                </div>
              </div>
              {lafcRow && (
                <div className="text-right">
                  <p className="text-2xl font-extrabold text-black leading-none">
                    {lafcRow.rank}
                    <span className="text-sm font-bold ml-0.5">위</span>
                  </p>
                  <p className="text-[10px] text-toss-gray-600 mt-0.5">서부</p>
                </div>
              )}
            </div>

            {lafcRow && (
              <>
                <div className="grid grid-cols-4 gap-2">
                  <SonStat label="승점" value={lafcRow.points} highlight />
                  <SonStat label="승" value={lafcRow.wins} />
                  <SonStat label="무" value={lafcRow.draws} />
                  <SonStat label="패" value={lafcRow.losses} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <SonStat label="경기" value={lafcRow.played} />
                  <SonStat label="득점" value={lafcRow.goals_for} />
                  <SonStat label="실점" value={lafcRow.goals_against} />
                </div>

                {/* 최근 5경기 폼 */}
                {lafcRow.recent_form && lafcRow.recent_form.length > 0 && (
                  <div className="mt-3 flex items-center justify-between bg-white/60 rounded-xl px-3 py-2">
                    <span className="text-[11px] font-bold text-black">
                      최근 5경기
                    </span>
                    <div className="flex gap-1">
                      {lafcRow.recent_form.map((f, i) => (
                        <FormDot key={i} result={f} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 인사이트 카드 */}
      {son && lafcRow && (
        <div className="px-5 mt-3">
          <div className="rounded-2xl bg-white p-4">
            <h3 className="text-sm font-bold text-toss-gray-900 mb-2 flex items-center gap-1.5">
              <TrendingUp size={16} className="text-toss-blue" />
              시즌 인사이트
            </h3>
            <div className="space-y-2.5">
              <InsightRow
                icon="📊"
                label="서부 평균 대비"
                value={`${aboveAvg >= 0 ? '+' : ''}${aboveAvg.toFixed(1)}점`}
                positive={aboveAvg >= 0}
              />
              <InsightRow
                icon="⚽"
                label="경기당 득점"
                value={
                  lafcRow.played > 0
                    ? (lafcRow.goals_for / lafcRow.played).toFixed(2)
                    : '0.00'
                }
              />
              <InsightRow
                icon="🛡️"
                label="경기당 실점"
                value={
                  lafcRow.played > 0
                    ? (lafcRow.goals_against / lafcRow.played).toFixed(2)
                    : '0.00'
                }
              />
              <InsightRow
                icon="🏆"
                label="플레이오프"
                value={lafcRow.rank <= 9 ? '진출권 안' : '진출권 밖'}
                positive={lafcRow.rank <= 9}
              />
            </div>
          </div>
        </div>
      )}

      {/* 코리안 리거 (손흥민 제외 다른 한국 선수들) */}
      {koreans && koreans.players.filter((p) => p.player_id !== '178194').length > 0 && (
        <div className="px-5 mt-3">
          <div className="rounded-2xl bg-white p-4">
            <h3 className="text-sm font-bold text-toss-gray-900 mb-3 flex items-center gap-1.5">
              <span className="text-base">🇰🇷</span>
              코리안 리거
            </h3>
            <p className="text-[11px] text-toss-gray-500 mb-3 leading-relaxed">
              MLS에서 뛰고 있는 다른 한국 선수들 (손흥민 외)
            </p>
            <div className="space-y-2">
              {koreans.players
                .filter((p) => p.player_id !== '178194')
                .map((p) => {
                  const teamInfo = getTeamByTeamId(p.team_id);
                  const teamColor = teamInfo?.color || '#191F28';
                  const teamBg = teamInfo?.bgLight || '#F2F4F6';
                  return (
                    <div
                      key={p.player_id}
                      className="rounded-xl p-3"
                      style={{ backgroundColor: teamBg }}
                    >
                      <div className="flex items-center gap-3">
                        <TeamLogo
                          team={teamInfo?.name || p.team_short}
                          size={36}
                          logoUrl={p.team_logo}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p
                              className="text-[13px] font-extrabold"
                              style={{ color: teamColor }}
                            >
                              {p.player_name_ko}
                            </p>
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                              style={{ backgroundColor: teamColor }}
                            >
                              #{p.jersey}
                            </span>
                            <span className="text-[10px] font-bold text-toss-gray-600">
                              {p.position === 'F'
                                ? '공격수'
                                : p.position === 'M'
                                ? '미드필더'
                                : p.position === 'D'
                                ? '수비수'
                                : p.position === 'G'
                                ? '골키퍼'
                                : p.position}
                            </span>
                          </div>
                          <p className="text-[11px] text-toss-gray-600 mt-0.5 truncate">
                            {p.team_name}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 mt-2">
                        <KoreanPlayerStat
                          label="경기"
                          value={p.appearances ?? 0}
                          color={teamColor}
                        />
                        <KoreanPlayerStat
                          label="골"
                          value={p.goals ?? 0}
                          color={teamColor}
                        />
                        <KoreanPlayerStat
                          label="어시"
                          value={p.assists ?? 0}
                          color={teamColor}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* 동기부여 카드 */}
      {son && (
        <div className="px-5 mb-4">
          <div
            className="rounded-2xl p-4 text-center"
            style={{ backgroundColor: lafcInfo.bgLight }}
          >
            <p className="text-2xl mb-1">🇰🇷⚽</p>
            <p className="text-sm font-bold text-black">
              세계 최고의 한국인 공격수
            </p>
            <p className="text-[12px] text-toss-gray-600 mt-1 leading-relaxed">
              미국 무대에서도 기대되는 활약을 보여주고 있어요.<br />
              매일 자동으로 최신 LAFC 순위가 업데이트됩니다.
            </p>
          </div>
        </div>
      )}

      {/* 배너 광고 (하단) */}
      {!loading && (
        <div className="px-5 mb-4">
          <BannerAd />
        </div>
      )}

      {/* 로딩 중 */}
      {loading && !son && (
        <div className="p-10 text-center text-toss-gray-400 text-sm">
          데이터를 불러오는 중...
        </div>
      )}
    </div>
  );
}

// ─── 서브 컴포넌트들 ───

function SonStat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div
      className="text-center rounded-xl py-2"
      style={{
        backgroundColor: highlight ? '#000000' : 'rgba(255,255,255,0.6)',
      }}
    >
      <p
        className="text-[10px]"
        style={{ color: highlight ? '#FFD700' : '#8B95A1' }}
      >
        {label}
      </p>
      <p
        className="text-sm font-extrabold mt-0.5"
        style={{ color: highlight ? '#FFD700' : '#000' }}
      >
        {value}
      </p>
    </div>
  );
}

function SonBigStat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="text-center rounded-xl py-3 bg-white/60">
      <p className="text-[10px] text-toss-gray-600">{label}</p>
      <p
        className="text-2xl font-extrabold mt-0.5 leading-none"
        style={{ color }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-toss-gray-500 mt-1 font-semibold">{sub}</p>
      )}
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center rounded-lg py-1.5 bg-white/50">
      <p className="text-[9px] text-toss-gray-500">{label}</p>
      <p className="text-[12px] font-extrabold text-black">{value}</p>
    </div>
  );
}

function MatchStat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center rounded-lg py-2 bg-white/70">
      <p className="text-[10px]" style={{ color: '#666' }}>
        {label}
      </p>
      <p
        className="text-base font-extrabold mt-0.5"
        style={{ color: highlight ? '#FF6B35' : '#000' }}
      >
        {value}
      </p>
    </div>
  );
}

function FormDot({ result }: { result: FormItem }) {
  const bg =
    result === 'W' ? '#0CB46E' : result === 'D' ? '#8B95A1' : '#FF6B35';
  const label = result === 'W' ? '승' : result === 'D' ? '무' : '패';
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-extrabold text-white"
      style={{ backgroundColor: bg }}
    >
      {label}
    </span>
  );
}

function InsightRow({
  icon,
  label,
  value,
  positive,
}: {
  icon: string;
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-[13px] text-toss-gray-700">
        <span className="text-base">{icon}</span>
        {label}
      </span>
      <span
        className="text-[13px] font-bold"
        style={{
          color:
            positive === undefined
              ? '#191F28'
              : positive
              ? '#0CB46E'
              : '#FF6B35',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function KoreanPlayerStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="text-center rounded-lg py-1.5 bg-white/70">
      <p className="text-[9px] text-toss-gray-500">{label}</p>
      <p
        className="text-[13px] font-extrabold mt-0.5"
        style={{ color }}
      >
        {value}
      </p>
    </div>
  );
}
