import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Trophy,
  Shield,
  Swords,
  Target,
  AlertTriangle,
  Zap,
  TrendingUp,
  TrendingDown,
  Flame,
  Star,
  Calendar,
  MapPin,
  Clock,
  Sparkles,
  Lightbulb,
} from 'lucide-react';
import {
  api,
  type StandingsResponse,
  type ScheduleResponse,
  type FormItem,
} from '@/utils/api';
import { getFavoriteTeam } from '@/utils/storage';
import { getTeam, TEAMS } from '@/data/teams';
import {
  generateTeamReport,
  type TeamReport,
  type AnalysisCard as ExpertCard,
} from '@/utils/teamAnalytics';
import RewardedAd from '@/components/RewardedAd';
import BannerAd from '@/components/BannerAd';
import TeamLogo from '@/components/TeamLogo';

export default function TeamReportPage() {
  const navigate = useNavigate();
  const favorite = getFavoriteTeam();
  const [report, setReport] = useState<TeamReport | null>(null);
  const [data, setData] = useState<StandingsResponse | null>(null);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [adShown, setAdShown] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const unlockedRef = useRef(false);

  // 응원팀 없으면 홈으로
  useEffect(() => {
    if (!favorite) {
      navigate('/', { replace: true });
    }
  }, [favorite, navigate]);

  // 데이터 로드 + 리포트 생성
  useEffect(() => {
    if (!favorite) return;
    (async () => {
      try {
        const [standings, sch] = await Promise.all([
          api.standings(),
          api.schedule().catch(() => null),
        ]);
        setData(standings);
        setSchedule(sch);
        const teamInfo = TEAMS[favorite];
        if (teamInfo?.teamId) {
          const sched = sch?.schedule?.[teamInfo.teamId];
          const r = generateTeamReport(teamInfo.teamId, standings, sched);
          setReport(r);
        }
      } catch (e) {
        console.warn('[TeamReport] load error:', e);
      } finally {
        setLoading(false);
        // 데이터 로드 완료 후 자동으로 리워드 광고 표시
        setAdShown(true);
      }
    })();
  }, [favorite]);

  const handleReward = () => {
    unlockedRef.current = true;
    setUnlocked(true);
  };

  const handleAdClose = () => {
    setAdShown(false);
    if (!unlockedRef.current) {
      navigate('/', { replace: true });
    }
  };

  if (!favorite) return null;

  const info = getTeam(favorite);

  // 즐겨찾기 팀의 row 찾기
  const allRows = data ? [...data.eastern, ...data.western] : [];
  const myRow = allRows.find((r) => r.team_id === info.teamId);
  const conferenceLabel = info.conference === 'eastern' ? '동부' : '서부';
  const teamSchedule = info.teamId ? schedule?.schedule?.[info.teamId] : undefined;

  return (
    <div className="min-h-screen bg-toss-gray-50">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 bg-white flex items-center gap-2">
        <button
          onClick={() => navigate('/', { replace: true })}
          className="p-1 -ml-1 rounded-full hover:bg-toss-gray-100"
          aria-label="뒤로"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="toss-title text-[22px]">📊 전문가 분석 리포트</h1>
          <p className="toss-caption mt-0.5">{info.fullName}</p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="p-10 text-center text-toss-gray-400 text-sm">
          분석 중...
        </div>
      )}

      {!loading && !report && (
        <div className="p-10 text-center text-toss-gray-400 text-sm">
          데이터가 부족해 리포트를 생성할 수 없어요
        </div>
      )}

      {!loading && report && myRow && (
        <>
          {/* 팀 헤드라인 */}
          <div className="px-5 mt-2">
            <div
              className="rounded-2xl p-4"
              style={{ backgroundColor: info.bgLight }}
            >
              <div className="flex items-center gap-3">
                <TeamLogo team={favorite} size={44} logoUrl={myRow.team_logo} />
                <div className="flex-1 min-w-0">
                  <p
                    className="font-bold text-base"
                    style={{ color: info.color }}
                  >
                    {info.fullName}
                  </p>
                  <p className="text-[12px] text-toss-gray-700 mt-0.5">
                    {conferenceLabel} 컨퍼런스 {report.form.rank}위 ·{' '}
                    {report.form.points}점
                  </p>
                </div>
              </div>
              <p
                className="text-[13px] mt-3 leading-relaxed font-semibold"
                style={{ color: info.color }}
              >
                {report.insight}
              </p>
            </div>
          </div>

          {/* 광고 시청 후 콘텐츠 표시 */}
          {unlocked ? (
            <ReportContent
              report={report}
              themeColor={info.color}
              teamSchedule={teamSchedule}
            />
          ) : (
            <div className="px-5 mt-6">
              <div className="text-center text-toss-gray-400 text-sm">
                광고 시청 후 분석 리포트가 열려요
              </div>
            </div>
          )}
        </>
      )}

      {/* 리워드 광고 모달 */}
      {adShown && (
        <RewardedAd onReward={handleReward} onClose={handleAdClose} />
      )}
    </div>
  );
}

// ─── 광고 시청 후 표시되는 분석 콘텐츠 ───
function ReportContent({
  report,
  themeColor,
  teamSchedule,
}: {
  report: TeamReport;
  themeColor: string;
  teamSchedule?: ScheduleResponse['schedule'][string];
}) {
  const { form, outlook, comparison, expertAnalysis, recentForm, predictedScore } = report;

  return (
    <div className="px-5 mt-3 space-y-3">
      {/* === 1. 최근 5경기 폼 분석 (모멘텀 카드) === */}
      <Card
        title="최근 5경기 폼"
        icon={
          recentForm.momentum === 'hot' ? (
            <Flame size={16} color="#FF6B35" />
          ) : recentForm.momentum === 'cold' ? (
            <TrendingDown size={16} color="#8B95A1" />
          ) : (
            <TrendingUp size={16} color={themeColor} />
          )
        }
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            {recentForm.form.slice(-5).map((item, i) => {
              const c =
                item === 'W'
                  ? '#0CB46E'
                  : item === 'L'
                  ? '#FF6B35'
                  : '#8B95A1';
              const label =
                item === 'W' ? '승' : item === 'L' ? '패' : '무';
              return (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-extrabold shadow-sm"
                  style={{ backgroundColor: c }}
                >
                  {label}
                </div>
              );
            })}
          </div>
          <div className="text-right">
            <p className="text-[10px] text-toss-gray-500">최근 승점</p>
            <p
              className="text-lg font-extrabold"
              style={{ color: themeColor }}
            >
              {recentForm.recentPoints}/15
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <MiniStat label="승" value={recentForm.recentWins} color="#0CB46E" />
          <MiniStat label="무" value={recentForm.recentDraws} color="#8B95A1" />
          <MiniStat label="패" value={recentForm.recentLosses} color="#FF6B35" />
        </div>
        <div
          className="rounded-xl p-3"
          style={{
            backgroundColor:
              recentForm.momentum === 'hot'
                ? '#FFF4ED'
                : recentForm.momentum === 'cold'
                ? '#F2F4F6'
                : '#F0F6FF',
          }}
        >
          <p
            className="text-[12px] font-semibold leading-relaxed"
            style={{
              color:
                recentForm.momentum === 'hot'
                  ? '#FF6B35'
                  : recentForm.momentum === 'cold'
                  ? '#4E5968'
                  : '#3182F6',
            }}
          >
            {recentForm.momentum === 'hot'
              ? '🔥 '
              : recentForm.momentum === 'cold'
              ? '🧊 '
              : '⚖️ '}
            {recentForm.trend}
          </p>
        </div>
      </Card>

      {/* === 2. 공격 스타일 카드 (전문가) === */}
      <ExpertCardBlock
        card={expertAnalysis.attackStyle}
        icon={<Swords size={16} color="#FF6B35" />}
        themeColor="#FF6B35"
      />

      {/* === 3. 수비 스타일 카드 (전문가) === */}
      <ExpertCardBlock
        card={expertAnalysis.defenseStyle}
        icon={<Shield size={16} color="#3182F6" />}
        themeColor="#3182F6"
      />

      {/* === 4. 강점 카드 === */}
      <ExpertCardBlock
        card={expertAnalysis.strength}
        icon={<Star size={16} color="#0CB46E" />}
        themeColor="#0CB46E"
      />

      {/* === 5. 약점 카드 === */}
      <ExpertCardBlock
        card={expertAnalysis.weakness}
        icon={<AlertTriangle size={16} color="#FFA500" />}
        themeColor="#FFA500"
      />

      {/* === 6. 전술 코멘트 === */}
      <Card
        title="전술 코멘트"
        icon={<Sparkles size={16} color={themeColor} />}
      >
        <div
          className="rounded-xl p-3.5"
          style={{ backgroundColor: `${themeColor}10` }}
        >
          <p
            className="text-[13px] leading-relaxed"
            style={{ color: '#191F28' }}
          >
            {expertAnalysis.tacticalNote}
          </p>
        </div>
      </Card>

      {/* === 7. 다음 경기 승리 키 포인트 === */}
      <Card
        title="다음 경기 승리 키"
        icon={<Lightbulb size={16} color="#F0C674" />}
      >
        <div className="rounded-xl p-3.5 bg-gradient-to-br from-[#FFF8D6] to-[#FFEFA5]">
          <p className="text-[13px] leading-relaxed text-[#3B2F00] font-medium">
            💡 {expertAnalysis.keyToWin}
          </p>
        </div>
      </Card>

      {/* === 7-2. 다음 경기 예상 스코어 (전문가 예측) === */}
      {predictedScore && teamSchedule?.next && (
        <Card
          title="🎯 다음 경기 예상 스코어"
          icon={<Target size={16} color={themeColor} />}
        >
          <div
            className="rounded-xl p-4"
            style={{
              background: `linear-gradient(135deg, ${themeColor}15 0%, ${themeColor}05 100%)`,
              border: `1px solid ${themeColor}25`,
            }}
          >
            {/* 스코어보드 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1 text-center">
                <p className="text-[10px] text-toss-gray-500 mb-1">
                  {predictedScore.myIsHome ? '🏠 홈' : '✈️ 원정'}
                </p>
                <p
                  className="text-[12px] font-extrabold truncate"
                  style={{ color: themeColor }}
                >
                  {predictedScore.myTeamName}
                </p>
              </div>
              <div className="px-3 text-center">
                <div className="flex items-center gap-2">
                  <span
                    className="text-3xl font-extrabold tabular-nums"
                    style={{ color: themeColor }}
                  >
                    {predictedScore.myScore}
                  </span>
                  <span className="text-toss-gray-400 text-xl font-bold">-</span>
                  <span className="text-3xl font-extrabold tabular-nums text-toss-gray-700">
                    {predictedScore.oppScore}
                  </span>
                </div>
                <p
                  className="text-[10px] font-bold mt-1"
                  style={{
                    color:
                      predictedScore.resultHint === '승'
                        ? '#0CB46E'
                        : predictedScore.resultHint === '패'
                        ? '#FF6B35'
                        : '#8B95A1',
                  }}
                >
                  예상: {predictedScore.resultHint}
                </p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-[10px] text-toss-gray-500 mb-1">
                  {predictedScore.myIsHome ? '✈️ 원정' : '🏠 홈'}
                </p>
                <p className="text-[12px] font-extrabold text-toss-gray-700 truncate">
                  {predictedScore.oppTeamName}
                </p>
              </div>
            </div>

            {/* 기댓값 (소수) */}
            <div className="flex items-center justify-center gap-2 mb-3 pt-2 border-t border-white/60">
              <span className="text-[10px] text-toss-gray-500">기댓값</span>
              <span className="text-[11px] font-bold text-toss-gray-700 tabular-nums">
                {predictedScore.myGoalsExpected.toFixed(2)} :{' '}
                {predictedScore.oppGoalsExpected.toFixed(2)}
              </span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                style={{
                  backgroundColor:
                    predictedScore.confidence === 'high'
                      ? '#0CB46E'
                      : predictedScore.confidence === 'medium'
                      ? '#3182F6'
                      : '#8B95A1',
                }}
              >
                신뢰도{' '}
                {predictedScore.confidence === 'high'
                  ? '높음'
                  : predictedScore.confidence === 'medium'
                  ? '보통'
                  : '낮음'}
              </span>
            </div>

            {/* 분석 텍스트 */}
            <p className="text-[12px] text-toss-gray-700 leading-relaxed">
              {predictedScore.reasoning}
            </p>
          </div>
          <p className="text-[10px] text-toss-gray-400 mt-2 leading-relaxed">
            * 양 팀 시즌 평균 + 최근 폼 + 홈 어드밴티지를 종합한 모델 예측이에요.
          </p>
        </Card>
      )}

      {/* === 8. 경기 일정 (다음 경기 + 지난 경기) === */}
      {teamSchedule?.next && (
        <Card
          title="경기 일정"
          icon={<Calendar size={16} color={themeColor} />}
        >
          {/* 다음 경기 */}
          <div
            className="rounded-xl p-3 mb-2"
            style={{
              backgroundColor: `${themeColor}10`,
              border: `1px solid ${themeColor}25`,
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: themeColor }}
              >
                ⚽ 다음 경기
              </span>
              {teamSchedule.next.days_until !== undefined &&
                teamSchedule.next.days_until !== null && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: themeColor }}
                  >
                    D-{teamSchedule.next.days_until}
                  </span>
                )}
            </div>
            <p className="text-sm font-bold text-toss-gray-900">
              {teamSchedule.next.home ? 'vs' : '@'} {teamSchedule.next.opponent_name}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <MapPin size={11} className="text-toss-gray-400" />
              <span className="text-[11px] text-toss-gray-500">
                {teamSchedule.next.home ? '홈' : '원정'} ·{' '}
                {teamSchedule.next.venue || ''}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/50">
              <Clock size={12} style={{ color: themeColor }} />
              <span
                className="text-xs font-bold"
                style={{ color: themeColor }}
              >
                🇰🇷 한국시간 {teamSchedule.next.kst_display}
              </span>
            </div>
          </div>

          {/* 지난 경기 */}
          {teamSchedule.last && (
            <div className="rounded-xl p-3 bg-toss-gray-50">
              <p className="text-[10px] font-bold text-toss-gray-500 uppercase tracking-wider mb-1.5">
                🕓 지난 경기
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-toss-gray-700">
                  {teamSchedule.last.home ? 'vs' : '@'}{' '}
                  {teamSchedule.last.opponent_name}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      teamSchedule.last.result === 'W'
                        ? 'bg-toss-green/10 text-toss-green'
                        : teamSchedule.last.result === 'L'
                        ? 'bg-toss-red/10 text-toss-red'
                        : 'bg-toss-gray-200 text-toss-gray-600'
                    }`}
                  >
                    {teamSchedule.last.result === 'W'
                      ? '승'
                      : teamSchedule.last.result === 'L'
                      ? '패'
                      : '무'}
                  </span>
                  <span className="text-sm font-extrabold text-toss-gray-900">
                    {teamSchedule.last.home_score}-{teamSchedule.last.away_score}
                  </span>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* === 9. 시즌 기록 카드 === */}
      <Card title="시즌 기록" icon={<Trophy size={16} color={themeColor} />}>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="경기" value={form.played} />
          <Stat label="승률" value={`${(form.winRate * 100).toFixed(0)}%`} />
          <Stat label="득실" value={form.goalDiffDisplay} />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <Stat label="승" value={form.wins} />
          <Stat label="무" value={form.draws} />
          <Stat label="패" value={form.losses} />
        </div>
      </Card>

      {/* === 10. 시즌 전망 === */}
      <Card title="시즌 전망" icon={<Target size={16} color={themeColor} />}>
        <div className="space-y-2.5">
          <Row
            label="시즌 종료 예상 승점"
            value={`약 ${outlook.projectedPoints}점`}
          />
          <Row
            label="컨퍼런스 1위와 차이"
            value={`${outlook.pointsBehindLeader}점`}
          />
          <Row
            label={
              outlook.pointsAheadOfPO >= 0
                ? '플레이오프 마지노선과 차이'
                : '플레이오프권까지 거리'
            }
            value={`${outlook.pointsAheadOfPO >= 0 ? '+' : ''}${outlook.pointsAheadOfPO}점`}
            positive={outlook.pointsAheadOfPO >= 0}
          />
          <Row
            label="플레이오프 진출 가능성"
            value={
              outlook.playoffProb === 'high'
                ? '높음 ✅'
                : outlook.playoffProb === 'medium'
                ? '중간 🎯'
                : '낮음 ⚠️'
            }
          />
          <Row
            label="컨퍼런스 우승 가능성"
            value={
              outlook.conferenceLeadProb === 'high'
                ? '높음 🏆'
                : outlook.conferenceLeadProb === 'medium'
                ? '경쟁권 🔥'
                : '낮음'
            }
          />
        </div>
      </Card>

      {/* === 11. 컨퍼런스 비교 === */}
      <Card
        title="컨퍼런스 평균 대비"
        icon={<Zap size={16} color={themeColor} />}
      >
        <div className="space-y-2.5">
          <Row
            label="평균 승점 대비"
            value={`${comparison.pointsVsAvg >= 0 ? '+' : ''}${comparison.pointsVsAvg.toFixed(1)}점`}
            positive={comparison.pointsVsAvg >= 0}
          />
          <Row
            label="공격력 (득점 순위)"
            value={`${comparison.attackRank}위 / ${comparison.conferenceTeamCount}팀`}
          />
          <Row
            label="수비력 (실점 순위)"
            value={`${comparison.defenseRank}위 / ${comparison.conferenceTeamCount}팀`}
          />
          <Row
            label="평균 득점 대비"
            value={`${comparison.goalsForVsAvg >= 0 ? '+' : ''}${comparison.goalsForVsAvg.toFixed(1)}골`}
            positive={comparison.goalsForVsAvg >= 0}
          />
          <Row
            label="평균 실점 대비"
            value={`${comparison.goalsAgainstVsAvg >= 0 ? '+' : ''}${comparison.goalsAgainstVsAvg.toFixed(1)}골`}
            positive={comparison.goalsAgainstVsAvg <= 0}
          />
        </div>
      </Card>

      {/* === 12. 플레이오프 탈락 위험 === */}
      {outlook.eliminationRisk !== 'low' && (
        <Card
          title="플레이오프 탈락 위험"
          icon={<AlertTriangle size={16} color="#FF6B35" />}
        >
          <p className="text-[13px] text-toss-gray-700 leading-relaxed">
            {outlook.eliminationRisk === 'high'
              ? '⚠️ 현재 플레이오프 진출이 어려운 상황입니다. 남은 경기에서 반등이 필요해요.'
              : '⚡ 플레이오프 경계선에 있어요. 중요한 경기들이 남아있습니다.'}
          </p>
        </Card>
      )}

      {/* === 13. 수비 통계 === */}
      <Card title="수비 통계" icon={<Shield size={16} color={themeColor} />}>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="총 득점" value={form.goalsFor} />
          <Stat label="총 실점" value={form.goalsAgainst} />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Stat
            label="경기당 득점"
            value={
              form.played > 0 ? (form.goalsFor / form.played).toFixed(2) : '0.00'
            }
          />
          <Stat
            label="경기당 실점"
            value={
              form.played > 0
                ? (form.goalsAgainst / form.played).toFixed(2)
                : '0.00'
            }
          />
        </div>
      </Card>

      {/* 하단 광고 */}
      <div className="pt-2">
        <BannerAd />
      </div>

      {/* 안내 문구 */}
      <p className="text-[10px] text-toss-gray-400 text-center mt-3 mb-4 leading-relaxed">
        * 본 리포트는 ESPN 공개 데이터를 기반으로 자동 생성됩니다.<br/>
        매일 새벽에 자동 업데이트돼요.
      </p>
    </div>
  );
}

// ─── 전문가 분석 카드 (별점 포함) ───
function ExpertCardBlock({
  card,
  icon,
  themeColor,
}: {
  card: ExpertCard;
  icon: React.ReactNode;
  themeColor: string;
}) {
  const filled = Math.max(0, Math.min(5, Math.round(card.rating)));
  return (
    <div className="rounded-2xl bg-white p-4">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-bold text-toss-gray-900 flex items-center gap-1.5">
          {icon}
          {card.title}
        </h3>
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              size={12}
              fill={i <= filled ? themeColor : 'none'}
              color={i <= filled ? themeColor : '#D1D6DB'}
              strokeWidth={2}
            />
          ))}
          <span
            className="ml-1 text-[11px] font-bold"
            style={{ color: themeColor }}
          >
            {card.rating.toFixed(1)}
          </span>
        </div>
      </div>
      <p className="text-[13px] text-toss-gray-700 leading-relaxed">
        {card.description}
      </p>
    </div>
  );
}

// ─── 유틸 컴포넌트 ───
function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <h3 className="text-sm font-bold text-toss-gray-900 mb-3 flex items-center gap-1.5">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="text-center bg-toss-gray-50 rounded-xl py-2">
      <p className="text-[10px] text-toss-gray-500">{label}</p>
      <p className="text-sm font-extrabold mt-0.5 text-toss-gray-900">
        {value}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="text-center bg-toss-gray-50 rounded-lg py-1.5">
      <p className="text-[10px] text-toss-gray-500">{label}</p>
      <p className="text-base font-extrabold mt-0.5" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-toss-gray-700">{label}</span>
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
