/**
 * MLS 팀 분석 리포트 생성 로직
 * - 컨퍼런스별 평균 비교
 * - 플레이오프/탈락 가능성 (1~9위 PO)
 * - 공격력/수비력 순위
 * - 최근 5경기 폼 분석
 * - 전문가급 텍스트 인사이트
 */

import type { MLSTeamStanding, StandingsResponse, FormItem, TeamSchedule } from './api';
import type { Conference } from '@/data/teams';
import { FALLBACK_STANDINGS } from './fallback';

// ─── 리포트 타입 정의 ──────────────────────────────

export interface TeamReport {
  insight: string;
  expertAnalysis: ExpertAnalysis;
  form: TeamForm;
  outlook: TeamOutlook;
  comparison: ConferenceComparison;
  recentForm: RecentFormAnalysis;
  predictedScore?: PredictedScore;  // 다음 경기 예상 스코어 (next 매치 + opponent_stats 필요)
}

// ─── 예상 스코어 ──────────────────────────────
export interface PredictedScore {
  myScore: number;          // 우리팀 예상 득점
  oppScore: number;         // 상대팀 예상 득점
  myGoalsExpected: number;  // 원시 기댓값 (소수)
  oppGoalsExpected: number;
  confidence: 'high' | 'medium' | 'low';
  myTeamName: string;
  oppTeamName: string;
  myIsHome: boolean;
  reasoning: string;        // 한 단락 분석
  resultHint: '승' | '무' | '패';
}

export interface TeamForm {
  rank: number;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  goalDiffDisplay: string;
  conference: Conference;
}

export interface TeamOutlook {
  pointsBehindLeader: number;
  pointsAheadOfPO: number;
  pointsAheadOfElim: number;
  remainingGames: number;
  playoffProb: 'high' | 'medium' | 'low';
  conferenceLeadProb: 'high' | 'medium' | 'low';
  eliminationRisk: 'high' | 'medium' | 'low';
  projectedPoints: number;    // 시즌 종료 예상 승점
}

export interface ConferenceComparison {
  pointsVsAvg: number;
  goalsForVsAvg: number;
  goalsAgainstVsAvg: number;
  attackRank: number;
  defenseRank: number;
  conferenceTeamCount: number;
  pointsPerGame: number;
}

export interface RecentFormAnalysis {
  form: FormItem[];
  recentWins: number;
  recentDraws: number;
  recentLosses: number;
  recentPoints: number;        // 최근 5경기 승점
  momentum: 'hot' | 'cold' | 'steady';  // 상승세 / 하락세 / 안정
  trend: string;               // 한 줄 트렌드 요약
}

// 전문가 분석 카드 - 4개 카테고리
export interface ExpertAnalysis {
  attackStyle: AnalysisCard;     // 공격 스타일
  defenseStyle: AnalysisCard;    // 수비 스타일
  strength: AnalysisCard;        // 강점
  weakness: AnalysisCard;        // 약점
  tacticalNote: string;          // 전술적 코멘트 (한 단락)
  keyToWin: string;              // 다음 경기 승리 키 포인트
}

export interface AnalysisCard {
  title: string;
  rating: number;        // 1~5
  description: string;
}

// ─── 메인 함수 ──────────────────────────────

export function generateTeamReport(
  favoriteTeamId: string,
  data: StandingsResponse | null,
  teamSchedule?: TeamSchedule | null
): TeamReport | null {
  if (!data) return null;

  const allRows = [...data.eastern, ...data.western];
  const myTeam = allRows.find((s) => s.team_id === favoriteTeamId);
  if (!myTeam) return null;

  const conference: Conference = data.eastern.find((s) => s.team_id === favoriteTeamId)
    ? 'eastern'
    : 'western';

  const conferenceTeams = conference === 'eastern' ? data.eastern : data.western;

  const form = analyzeForm(myTeam, conference);
  const outlook = analyzeOutlook(myTeam, conferenceTeams);
  const comparison = compareToConference(myTeam, conferenceTeams);
  const recentForm = analyzeRecentForm(myTeam);
  const expertAnalysis = generateExpertAnalysis(myTeam, comparison, recentForm);
  const insight = generateInsight(myTeam, form, outlook, recentForm);
  const predictedScore = predictNextMatchScore(myTeam, teamSchedule, recentForm);

  return { insight, expertAnalysis, form, outlook, comparison, recentForm, predictedScore };
}

// ─── 1. 폼 분석 ──────────────────────────────

function analyzeForm(team: MLSTeamStanding, conference: Conference): TeamForm {
  const winRate = team.played > 0 ? team.wins / team.played : 0;
  return {
    rank: team.rank,
    points: team.points,
    played: team.played,
    wins: team.wins,
    draws: team.draws,
    losses: team.losses,
    winRate,
    goalsFor: team.goals_for,
    goalsAgainst: team.goals_against,
    goalDiff: team.goal_diff,
    goalDiffDisplay: team.goal_diff_display,
    conference,
  };
}

// ─── 2. 전망 분석 ──────────────────────────────

function analyzeOutlook(team: MLSTeamStanding, conference: MLSTeamStanding[]): TeamOutlook {
  const leader = conference[0];
  const pointsBehindLeader = leader ? leader.points - team.points : 0;

  const ninth = conference[8];
  const pointsAheadOfPO = ninth ? team.points - ninth.points : 0;

  const tenth = conference[9];
  const pointsAheadOfElim = tenth ? team.points - tenth.points : 0;

  const remainingGames = Math.max(0, 34 - team.played);
  const ppg = team.played > 0 ? team.points / team.played : 0;
  const projectedPoints = Math.round(team.points + ppg * remainingGames);

  let playoffProb: 'high' | 'medium' | 'low' = 'medium';
  if (team.rank <= 6) playoffProb = 'high';
  else if (team.rank <= 9) playoffProb = 'medium';
  else playoffProb = 'low';

  let conferenceLeadProb: 'high' | 'medium' | 'low' = 'low';
  if (team.rank === 1) conferenceLeadProb = 'high';
  else if (team.rank <= 3 && pointsBehindLeader <= 6) conferenceLeadProb = 'medium';

  let eliminationRisk: 'high' | 'medium' | 'low' = 'low';
  if (team.rank >= 13) eliminationRisk = 'high';
  else if (team.rank >= 10) eliminationRisk = 'medium';

  return {
    pointsBehindLeader,
    pointsAheadOfPO,
    pointsAheadOfElim,
    remainingGames,
    playoffProb,
    conferenceLeadProb,
    eliminationRisk,
    projectedPoints,
  };
}

// ─── 3. 컨퍼런스 비교 ──────────────────────────────

function compareToConference(
  team: MLSTeamStanding,
  conference: MLSTeamStanding[]
): ConferenceComparison {
  if (conference.length === 0) {
    return {
      pointsVsAvg: 0, goalsForVsAvg: 0, goalsAgainstVsAvg: 0,
      attackRank: 0, defenseRank: 0, conferenceTeamCount: 0, pointsPerGame: 0,
    };
  }

  const avgPoints = conference.reduce((s, t) => s + t.points, 0) / conference.length;
  const avgGoalsFor = conference.reduce((s, t) => s + t.goals_for, 0) / conference.length;
  const avgGoalsAgainst = conference.reduce((s, t) => s + t.goals_against, 0) / conference.length;

  const byAttack = [...conference].sort((a, b) => b.goals_for - a.goals_for);
  const attackRank = byAttack.findIndex((t) => t.team_id === team.team_id) + 1;

  const byDefense = [...conference].sort((a, b) => a.goals_against - b.goals_against);
  const defenseRank = byDefense.findIndex((t) => t.team_id === team.team_id) + 1;

  const pointsPerGame = team.played > 0 ? team.points / team.played : 0;

  return {
    pointsVsAvg: team.points - avgPoints,
    goalsForVsAvg: team.goals_for - avgGoalsFor,
    goalsAgainstVsAvg: team.goals_against - avgGoalsAgainst,
    attackRank,
    defenseRank,
    conferenceTeamCount: conference.length,
    pointsPerGame,
  };
}

// ─── 4. 최근 폼 분석 ──────────────────────────────

function analyzeRecentForm(team: MLSTeamStanding): RecentFormAnalysis {
  // 1차: team.recent_form 그대로 사용
  let form = team.recent_form || [];

  // 2차 안전망: 비어있으면 fallback에서 같은 team_id 매칭해서 보충
  if (form.length === 0) {
    const allFallback = [...FALLBACK_STANDINGS.eastern, ...FALLBACK_STANDINGS.western];
    const fb = allFallback.find((f) => f.team_id === team.team_id);
    if (fb?.recent_form?.length) {
      form = fb.recent_form;
    }
  }

  const w = form.filter((f) => f === 'W').length;
  const d = form.filter((f) => f === 'D').length;
  const l = form.filter((f) => f === 'L').length;
  const pts = w * 3 + d;

  let momentum: 'hot' | 'cold' | 'steady' = 'steady';
  if (pts >= 10) momentum = 'hot';
  else if (pts <= 4) momentum = 'cold';

  // 최근 3경기 추세 (마지막 3개)
  const last3 = form.slice(-3);
  const last3W = last3.filter((f) => f === 'W').length;
  const last3L = last3.filter((f) => f === 'L').length;

  let trend = '';
  if (form.length === 0) {
    trend = '최근 경기 데이터 없음';
  } else if (momentum === 'hot') {
    trend = `🔥 최근 5경기 ${w}승 ${d}무 ${l}패! 상승세 절정에 있어요.`;
  } else if (momentum === 'cold') {
    trend = `❄️ 최근 5경기 ${w}승 ${d}무 ${l}패. 부진을 끊어낼 반등이 필요해요.`;
  } else if (last3W >= 2) {
    trend = `📈 최근 3경기 ${last3W}승. 회복세를 보이고 있어요.`;
  } else if (last3L >= 2) {
    trend = `📉 최근 3경기 ${last3L}패. 분위기 전환이 시급해요.`;
  } else {
    trend = `⚖️ 최근 5경기 ${w}승 ${d}무 ${l}패. 기복이 있는 흐름이에요.`;
  }

  return {
    form,
    recentWins: w,
    recentDraws: d,
    recentLosses: l,
    recentPoints: pts,
    momentum,
    trend,
  };
}

// ─── 5. 전문가급 분석 카드 생성 ──────────────────────────────

function generateExpertAnalysis(
  team: MLSTeamStanding,
  comparison: ConferenceComparison,
  recentForm: RecentFormAnalysis
): ExpertAnalysis {
  const gf = team.goals_for;
  const ga = team.goals_against;
  const played = team.played || 1;
  const gfpg = gf / played;
  const gapg = ga / played;

  // ── 공격 스타일 ──
  let attackTitle = '균형 잡힌 공격';
  let attackRating = 3;
  let attackDesc = '';
  if (gfpg >= 2.2) {
    attackTitle = '리그 최정상 공격력';
    attackRating = 5;
    attackDesc = `경기당 평균 ${gfpg.toFixed(2)}골로 컨퍼런스를 압도하는 화력. 다득점 공격축구를 구사하며 상대 수비를 끊임없이 흔드는 스타일.`;
  } else if (gfpg >= 1.8) {
    attackTitle = '리그 상위권 공격';
    attackRating = 4;
    attackDesc = `경기당 ${gfpg.toFixed(2)}골로 컨퍼런스 ${comparison.attackRank}위. 결정력 있는 공격진과 안정적인 빌드업의 조화가 돋보이는 팀.`;
  } else if (gfpg >= 1.3) {
    attackTitle = '균형 잡힌 공격';
    attackRating = 3;
    attackDesc = `경기당 ${gfpg.toFixed(2)}골로 평균 수준. 폭발적이진 않아도 꾸준히 득점을 만들어내는 효율적 공격이 강점.`;
  } else if (gfpg >= 0.9) {
    attackTitle = '결정력 부족';
    attackRating = 2;
    attackDesc = `경기당 ${gfpg.toFixed(2)}골로 컨퍼런스 ${comparison.attackRank}위. 기회 창출은 있으나 마무리에서 아쉬움. 결정적 한 방이 필요한 시점.`;
  } else {
    attackTitle = '득점력 위기';
    attackRating = 1;
    attackDesc = `경기당 ${gfpg.toFixed(2)}골로 컨퍼런스 최하위권. 공격 시스템 전면 재정비나 새 공격 옵션 투입이 시급한 상황.`;
  }

  // ── 수비 스타일 ──
  let defenseTitle = '안정적 수비';
  let defenseRating = 3;
  let defenseDesc = '';
  if (gapg <= 0.8) {
    defenseTitle = '철벽 수비';
    defenseRating = 5;
    defenseDesc = `경기당 실점 ${gapg.toFixed(2)}골. 컨퍼런스 ${comparison.defenseRank}위의 굳건한 수비라인. 무실점 경기를 자주 만드는 조직력 갖춤.`;
  } else if (gapg <= 1.2) {
    defenseTitle = '안정적 수비';
    defenseRating = 4;
    defenseDesc = `경기당 ${gapg.toFixed(2)}실점으로 컨퍼런스 상위권 수비. 백포 라인과 GK의 호흡이 안정적이며 큰 실점이 적음.`;
  } else if (gapg <= 1.6) {
    defenseTitle = '평균적 수비';
    defenseRating = 3;
    defenseDesc = `경기당 ${gapg.toFixed(2)}실점. 큰 약점은 아니나 강팀과의 맞대결에서 흔들리는 모습이 관찰됨. 집중력 유지가 관건.`;
  } else if (gapg <= 2.2) {
    defenseTitle = '수비 불안';
    defenseRating = 2;
    defenseDesc = `경기당 ${gapg.toFixed(2)}실점으로 컨퍼런스 ${comparison.defenseRank}위. 세트피스 및 역습 상황에서 자주 무너지는 양상. 수비 조직 재정비 필요.`;
  } else {
    defenseTitle = '수비 붕괴';
    defenseRating = 1;
    defenseDesc = `경기당 ${gapg.toFixed(2)}실점은 리그 최악 수준. 라인 컨트롤과 압박 강도 모두에서 문제가 누적된 상태.`;
  }

  // ── 강점 ──
  let strengthTitle = '';
  let strengthRating = 3;
  let strengthDesc = '';
  if (team.rank <= 3 && recentForm.momentum === 'hot') {
    strengthTitle = '상위권 + 상승세 = 무서운 페이스';
    strengthRating = 5;
    strengthDesc = `현재 ${team.rank}위에 최근 5경기 ${recentForm.recentWins}승. 컨디션 정점에서 시즌 후반부 우승 경쟁 다크호스로 부상 중.`;
  } else if (gf > 0 && ga > 0 && (gf / Math.max(ga, 1)) >= 2) {
    strengthTitle = '득실 균형 압도';
    strengthRating = 5;
    strengthDesc = `득실차 ${team.goal_diff_display}로 컨퍼런스 최상위권. 공수 모두 안정된 팀의 전형으로 시즌 내내 무너지지 않는 강팀의 조건을 갖춤.`;
  } else if (comparison.attackRank <= 3) {
    strengthTitle = '리그 최정상 공격력';
    strengthRating = 4;
    strengthDesc = `컨퍼런스 득점 ${comparison.attackRank}위. 어떤 상대를 만나도 한 골은 넣을 수 있는 공격력이 가장 큰 무기.`;
  } else if (comparison.defenseRank <= 3) {
    strengthTitle = '리그 최정상 수비력';
    strengthRating = 4;
    strengthDesc = `컨퍼런스 실점 ${comparison.defenseRank}위. 가장 적게 실점하는 수비 조직력은 빅매치에서 진가를 발휘.`;
  } else if (recentForm.momentum === 'hot') {
    strengthTitle = '최근 폼 상승세';
    strengthRating = 4;
    strengthDesc = `최근 5경기 ${recentForm.recentPoints}점 적립. 시즌 중반 깨어난 페이스가 후반부 도약의 발판이 될 가능성이 큼.`;
  } else if (team.draws >= played * 0.4) {
    strengthTitle = '안정적인 무승부 능력';
    strengthRating = 3;
    strengthDesc = `${team.draws}무로 패하지 않는 끈끈함이 강점. 다만 결정적 한 방으로 승점 3점을 가져오는 과감함이 더해진다면 도약 가능.`;
  } else {
    strengthTitle = '경험과 끈기';
    strengthRating = 3;
    strengthDesc = `눈에 띄는 압도적 강점은 없지만 매 경기 끈기 있게 싸우는 자세가 시즌 후반 변수를 만들 수 있는 잠재력.`;
  }

  // ── 약점 ──
  let weaknessTitle = '';
  let weaknessRating = 3;
  let weaknessDesc = '';
  if (team.losses >= played * 0.5) {
    weaknessTitle = '잦은 패배';
    weaknessRating = 4;
    weaknessDesc = `${played}경기 중 ${team.losses}패로 패배율이 절반을 넘음. 멘탈과 자신감 회복이 가장 시급한 과제.`;
  } else if (gapg >= 2.0) {
    weaknessTitle = '구멍난 수비';
    weaknessRating = 4;
    weaknessDesc = `경기당 ${gapg.toFixed(2)}실점은 플레이오프 다툼하는 팀에게 치명적인 수치. 압박 시점과 라인 간격에 구조적 문제 존재.`;
  } else if (gfpg <= 1.0) {
    weaknessTitle = '결정력 부재';
    weaknessRating = 4;
    weaknessDesc = `경기당 ${gfpg.toFixed(2)}골은 명백한 약점. 골 결정력 있는 공격수 영입이나 세트피스 다변화가 시급.`;
  } else if (recentForm.momentum === 'cold') {
    weaknessTitle = '최근 부진';
    weaknessRating = 3;
    weaknessDesc = `최근 5경기 ${recentForm.recentPoints}점. 누적된 피로와 자신감 저하가 결과로 이어지는 악순환 진입 우려.`;
  } else if (Math.abs(comparison.goalsAgainstVsAvg) < 2 && Math.abs(comparison.goalsForVsAvg) < 2) {
    weaknessTitle = '결정적 한 방 부재';
    weaknessRating = 3;
    weaknessDesc = `공수 모두 평균 수준에 머물러 있어 강팀에게 압도당하기 쉬움. 위기를 뒤집는 슈퍼스타급 역할이 부족.`;
  } else {
    weaknessTitle = '집중력 유지';
    weaknessRating = 2;
    weaknessDesc = `큰 약점은 보이지 않지만 빅매치에서의 집중력 유지가 관건. 90분 내내 동일한 강도를 유지하는 게 다음 단계 과제.`;
  }

  // ── 전술 코멘트 ──
  let tacticalNote = '';
  if (gfpg >= 1.8 && gapg <= 1.2) {
    tacticalNote = '공수 밸런스가 완벽에 가까운 팀. 점유율을 가져가면서도 역습 시 빠른 전환으로 결정짓는 4-3-3 또는 4-2-3-1이 잘 작동하고 있어요. 후반부 플레이오프 다크호스로 충분히 평가받을 만한 전술 완성도.';
  } else if (gfpg >= 1.8 && gapg > 1.5) {
    tacticalNote = '득점은 많지만 실점도 많은 전형적인 공격축구 팀. 백포 라인이 높게 올라온 만큼 역습에 취약. 단점을 감수하더라도 공격성을 유지할지, 안정을 택할지 감독의 판단이 시즌을 가를 변수.';
  } else if (gfpg < 1.3 && gapg <= 1.2) {
    tacticalNote = '실점은 적지만 득점이 부족한 수비 우선 스타일. 한 골 차 박빙 승부에 강하나 강팀 상대 추격전에서 무력함 노출. 공격 옵션의 다변화가 다음 도약의 열쇠.';
  } else if (gfpg < 1.2 && gapg >= 1.8) {
    tacticalNote = '공수 모두 평균 이하의 어려운 상황. 시스템 전면 재검토가 필요한 시점으로, 단순 전술 변경보다는 핵심 선수의 컨디션 점검과 새 자원 투입이 우선되어야 할 국면.';
  } else {
    tacticalNote = '균형 잡힌 전술적 접근으로 안정적 결과 도출 중. 다만 강팀 상대로 한 단계 더 올라서기 위해선 빅매치 전용 플랜 B를 가다듬는 작업이 필요해 보임.';
  }

  // ── 다음 경기 키 포인트 ──
  let keyToWin = '';
  if (recentForm.momentum === 'hot') {
    keyToWin = '🔥 상승세 유지가 핵심. 최근의 공격 패턴을 그대로 가져가되, 상대의 카운터 어택 옵션을 사전에 차단하는 미드필드 압박이 승부처.';
  } else if (recentForm.momentum === 'cold') {
    keyToWin = '🔄 분위기 전환이 최우선. 초반 20분 안에 선제골을 노려 심리적 우위를 확보하고, 무리한 빌드업보다 안정적인 박스 투 박스 운영이 권장됨.';
  } else if (comparison.attackRank <= 3) {
    keyToWin = '⚡ 공격력을 살리는 빠른 전환이 키. 측면에서의 크로스 공급과 박스 안 마무리 효율을 평소대로 유지하면 충분히 승점 3점 가능.';
  } else if (comparison.defenseRank <= 3) {
    keyToWin = '🛡️ 수비 안정성을 활용한 역습 한 방. 상대 공격을 견딘 뒤 측면 또는 핵심 미드필더를 통한 빠른 전개로 결정적 기회를 만드는 게 정석.';
  } else {
    keyToWin = '🎯 세트피스 활용도가 승부를 가를 가능성. 평소보다 코너킥/프리킥 상황에서의 변형 옵션을 다양화해 결정적 한 방을 노려야 함.';
  }

  return {
    attackStyle: { title: attackTitle, rating: attackRating, description: attackDesc },
    defenseStyle: { title: defenseTitle, rating: defenseRating, description: defenseDesc },
    strength: { title: strengthTitle, rating: strengthRating, description: strengthDesc },
    weakness: { title: weaknessTitle, rating: weaknessRating, description: weaknessDesc },
    tacticalNote,
    keyToWin,
  };
}

// ─── 6. 핵심 인사이트 한 줄 ──────────────────────────────

function generateInsight(
  team: MLSTeamStanding,
  form: TeamForm,
  outlook: TeamOutlook,
  recentForm: RecentFormAnalysis
): string {
  const conferenceLabel = form.conference === 'eastern' ? '동부' : '서부';

  if (team.rank === 1) {
    return `🏆 ${conferenceLabel} 컨퍼런스 1위! 압도적 페이스를 이어가고 있어요. ${recentForm.trend}`;
  }
  if (team.rank <= 3) {
    return `🔥 ${conferenceLabel} 컨퍼런스 ${team.rank}위, 1위와 ${outlook.pointsBehindLeader}점 차이! 우승 경쟁권에 있어요.`;
  }
  if (team.rank <= 6) {
    return `✅ ${conferenceLabel} ${team.rank}위, 플레이오프 안정권. 상위권 진입을 노릴 수 있어요.`;
  }
  if (team.rank <= 9) {
    return `🎯 ${conferenceLabel} ${team.rank}위, 플레이오프 경계선. ${outlook.pointsAheadOfPO}점 차이로 9위권 유지 중!`;
  }
  if (team.rank <= 12) {
    return `⚠️ ${conferenceLabel} ${team.rank}위, 플레이오프 진출이 어려운 상황. 반등이 필요해요.`;
  }
  return `🆘 ${conferenceLabel} ${team.rank}위, 시즌이 어려운 상황. 남은 경기에서 분발이 필요해요.`;
}

// ─── 7. 다음 경기 예상 스코어 ──────────────────────────────

/**
 * 다음 경기 예상 스코어 계산
 * 공식:
 *   homeGoals = (홈팀.득점/경기 + 원정팀.실점/경기) / 2
 *   awayGoals = (원정팀.득점/경기 + 홈팀.실점/경기) / 2
 *   + 최근 폼 보정 (hot +0.3, cold -0.3)
 *   + 홈 어드밴티지 +0.3 (홈팀 쪽)
 * 그리고 0.5 단위 반올림 후 정수로 표시.
 */
function predictNextMatchScore(
  myTeam: MLSTeamStanding,
  teamSchedule: TeamSchedule | null | undefined,
  recentForm: RecentFormAnalysis
): PredictedScore | undefined {
  const next = teamSchedule?.next;
  if (!next || !next.opponent_stats) return undefined;

  const opp = next.opponent_stats;
  const myPlayed = Math.max(1, myTeam.played);
  const oppPlayed = Math.max(1, opp.played);

  // 경기당 평균
  const myGfPg = myTeam.goals_for / myPlayed;
  const myGaPg = myTeam.goals_against / myPlayed;
  const oppGfPg = opp.goals_for / oppPlayed;
  const oppGaPg = opp.goals_against / oppPlayed;

  // 상대 폼 모멘텀 계산
  const oppForm = opp.recent_form || [];
  const oppW = oppForm.filter((f) => f === 'W').length;
  const oppD = oppForm.filter((f) => f === 'D').length;
  const oppL = oppForm.filter((f) => f === 'L').length;
  const oppPts = oppW * 3 + oppD;
  let oppMomentumAdj = 0;
  if (oppPts >= 10) oppMomentumAdj = 0.3;
  else if (oppPts <= 4) oppMomentumAdj = -0.3;

  // 우리 폼 모멘텀
  let myMomentumAdj = 0;
  if (recentForm.momentum === 'hot') myMomentumAdj = 0.3;
  else if (recentForm.momentum === 'cold') myMomentumAdj = -0.3;

  // 기댓값 계산 (소수)
  let myExpected = (myGfPg + oppGaPg) / 2 + myMomentumAdj;
  let oppExpected = (oppGfPg + myGaPg) / 2 + oppMomentumAdj;

  // 홈 어드밴티지
  if (next.home) myExpected += 0.3;
  else oppExpected += 0.3;

  // 음수 방지
  myExpected = Math.max(0, myExpected);
  oppExpected = Math.max(0, oppExpected);

  // 0.5 단위 반올림 → 정수 반올림
  const myScore = Math.round(myExpected);
  const oppScore = Math.round(oppExpected);

  // 신뢰도 계산: 경기수 적거나 폼 데이터 부족하면 낮음
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  const totalPlayed = myPlayed + oppPlayed;
  if (totalPlayed >= 22 && oppForm.length >= 3) confidence = 'high';
  else if (totalPlayed < 14 || oppForm.length === 0) confidence = 'low';

  // 결과 힌트
  let resultHint: '승' | '무' | '패' = '무';
  if (myScore > oppScore) resultHint = '승';
  else if (myScore < oppScore) resultHint = '패';

  // 분석 텍스트 생성
  const myAbbr = myTeam.team_short_name || myTeam.team_name;
  const oppAbbr = next.opponent_short || next.opponent_name;
  const homeAwayLabel = next.home ? '홈' : '원정';
  const venueAdv = next.home ? 'BMO 홈 분위기' : '원정 어웨이';

  const parts: string[] = [];
  parts.push(`${myAbbr} 경기당 ${myGfPg.toFixed(2)}득점 / ${myGaPg.toFixed(2)}실점`);
  parts.push(`${oppAbbr}는 ${oppGfPg.toFixed(2)}득점 / ${oppGaPg.toFixed(2)}실점`);

  let momentumNote = '';
  if (recentForm.momentum === 'hot' && oppPts <= 4) {
    momentumNote = `🔥 ${myAbbr}는 상승세, 상대 ${oppAbbr}는 침체기 — 큰 격차 예상`;
  } else if (recentForm.momentum === 'cold' && oppPts >= 10) {
    momentumNote = `⚠️ ${myAbbr}가 부진한 가운데 ${oppAbbr}가 호조 — 어려운 경기`;
  } else if (recentForm.momentum === 'hot') {
    momentumNote = `📈 ${myAbbr}의 좋은 폼이 변수`;
  } else if (oppPts >= 10) {
    momentumNote = `📊 ${oppAbbr}가 상승세라 견제 필요`;
  } else {
    momentumNote = `⚖️ 양 팀 비슷한 흐름`;
  }

  const reasoning = `${parts.join(', ')}. ${homeAwayLabel} 어드밴티지 반영. ${momentumNote}. 종합 예상 스코어: ${myAbbr} ${myScore} - ${oppScore} ${oppAbbr}.`;

  return {
    myScore,
    oppScore,
    myGoalsExpected: myExpected,
    oppGoalsExpected: oppExpected,
    confidence,
    myTeamName: myAbbr,
    oppTeamName: oppAbbr,
    myIsHome: next.home,
    reasoning,
    resultHint,
  };
}
