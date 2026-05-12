// MLS 순위 앱 데이터 스크래퍼 - ESPN 비공식 API
// 매일 GitHub Actions에서 자동 실행
// v3.0 - 확장판: standings + recent_form + son stats + scorers + schedule
//
// 출력 파일:
//   - data/standings.json   (순위 + 최근 5경기 폼)
//   - data/son.json         (LAFC + 손흥민 통계 + 지난/다음 경기)
//   - data/scorers.json     (MLS 득점/어시스트 순위)
//   - data/schedule.json    (각 팀의 last/next 경기, 한국시간 포함)
//   - data/meta.json        (메타 정보)

const fs = require('fs');
const path = require('path');
const https = require('https');

// ===== ESPN API 엔드포인트 =====
const STANDINGS_URL = 'https://site.web.api.espn.com/apis/v2/sports/soccer/usa.1/standings?level=3';
const LAFC_TEAM_ID = '18966';
const SON_ATHLETE_ID = '178194'; // ESPN 손흥민 athlete ID

const LAFC_TEAM_URL = `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/teams/${LAFC_TEAM_ID}`;
const TEAM_SCHEDULE_URL = (teamId) =>
  `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/teams/${teamId}/schedule`;
const LEADERS_URL =
  'https://site.web.api.espn.com/apis/site/v2/sports/soccer/usa.1/leaders?lang=en&region=us';
const ATHLETE_STATS_URL = (id) =>
  `https://site.web.api.espn.com/apis/common/v3/sports/soccer/usa.1/athletes/${id}/statistics`;
const ATHLETE_GAMELOG_URL = (id) =>
  `https://site.web.api.espn.com/apis/common/v3/sports/soccer/usa.1/athletes/${id}/gamelog`;

const SEASON = 2026;
const DATA_DIR = path.join(__dirname, '..', 'data');

// ===== HTTP 유틸 =====
function httpsGet(url, { silent404 = false } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; mls-app-scraper/3.0)',
          Accept: 'application/json',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString();
          if (res.statusCode !== 200) {
            if (silent404 && res.statusCode === 404) return resolve(null);
            return reject(new Error(`HTTP ${res.statusCode}: ${body.substring(0, 300)}`));
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`JSON parse failed: ${body.substring(0, 300)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('Request timeout')));
  });
}

// 동시 호출 제한 (ESPN rate limit 회피)
async function pLimit(tasks, concurrency = 6) {
  const results = [];
  const executing = [];
  for (const task of tasks) {
    const p = Promise.resolve().then(task);
    results.push(p);
    if (concurrency <= tasks.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

function writeJsonSafe(filename, data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const fullPath = path.join(DATA_DIR, filename);
  const tmpPath = fullPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, fullPath);
  console.log(`  -> ${filename} (${JSON.stringify(data).length} bytes)`);
}

// ===== 통계 추출 유틸 =====
function findStat(stats, names) {
  if (!Array.isArray(stats)) return null;
  for (const name of names) {
    const stat = stats.find(
      (s) =>
        s.name === name ||
        s.abbreviation === name ||
        s.shortDisplayName === name ||
        s.type === name
    );
    if (stat) return stat;
  }
  return null;
}

function getStatValue(stats, names, defaultValue = 0) {
  const stat = findStat(stats, names);
  if (!stat) return defaultValue;
  if (stat.value !== undefined && stat.value !== null) return Number(stat.value);
  if (stat.displayValue !== undefined) {
    const num = parseFloat(stat.displayValue);
    if (!isNaN(num)) return num;
  }
  return defaultValue;
}

function getStatDisplay(stats, names, defaultValue = '0') {
  const stat = findStat(stats, names);
  if (!stat) return defaultValue;
  return stat.displayValue || String(stat.value || defaultValue);
}

// ===== 한국시간 변환 =====
const KST_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function toKSTDisplay(isoDate) {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    // KST = UTC + 9h
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const month = kst.getUTCMonth() + 1;
    const day = kst.getUTCDate();
    const weekday = KST_WEEKDAYS[kst.getUTCDay()];
    let hour = kst.getUTCHours();
    const minute = kst.getUTCMinutes();
    const ampm = hour < 12 ? '오전' : '오후';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    const mm = String(minute).padStart(2, '0');
    return `${month}월 ${day}일 (${weekday}) ${ampm} ${hour12}:${mm}`;
  } catch {
    return '';
  }
}

function toKSTISO(isoDate) {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString();
  } catch {
    return '';
  }
}

function daysUntil(isoDate) {
  if (!isoDate) return null;
  try {
    const target = new Date(isoDate);
    const now = new Date();
    const diff = target.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  } catch {
    return null;
  }
}

// ===== 경기 결과 파서 =====
// ESPN team schedule API의 한 event(경기)에서, 해당 팀 관점의 결과를 추출
function parseEventForTeam(event, teamId) {
  if (!event || !event.competitions || event.competitions.length === 0) return null;
  const comp = event.competitions[0];
  const competitors = comp.competitors || [];
  const me = competitors.find((c) => String(c.team?.id) === String(teamId));
  const opp = competitors.find((c) => String(c.team?.id) !== String(teamId));
  if (!me || !opp) return null;

  const status = event.status?.type?.state || comp.status?.type?.state || 'pre';
  const completed = status === 'post';
  const inProgress = status === 'in';

  const myScore = parseInt(me.score, 10);
  const oppScore = parseInt(opp.score, 10);
  let result = null;
  if (completed && !isNaN(myScore) && !isNaN(oppScore)) {
    if (myScore > oppScore) result = 'W';
    else if (myScore < oppScore) result = 'L';
    else result = 'D';
  }

  // home/away는 me.homeAway: 'home' | 'away'
  const homeAway = me.homeAway;
  const isHome = homeAway === 'home';

  // 경기장
  const venue = comp.venue?.fullName || comp.venue?.shortName || '';

  // 라운드
  const round =
    comp.notes?.find((n) => /week|round|matchday/i.test(n.type))?.headline ||
    event.season?.slug ||
    '';

  return {
    match_id: String(event.id || comp.id || ''),
    date: event.date || comp.date || '',
    date_kst: toKSTISO(event.date || comp.date),
    kst_display: toKSTDisplay(event.date || comp.date),
    status,
    completed,
    in_progress: inProgress,
    home: isHome,
    home_score: isHome ? (isNaN(myScore) ? 0 : myScore) : (isNaN(oppScore) ? 0 : oppScore),
    away_score: isHome ? (isNaN(oppScore) ? 0 : oppScore) : (isNaN(myScore) ? 0 : myScore),
    my_score: isNaN(myScore) ? null : myScore,
    opp_score: isNaN(oppScore) ? null : oppScore,
    result,
    opponent_id: String(opp.team?.id || ''),
    opponent_name: opp.team?.displayName || opp.team?.name || '',
    opponent_short: opp.team?.shortDisplayName || opp.team?.abbreviation || '',
    opponent_logo:
      (opp.team?.logos && opp.team.logos[0]?.href) ||
      opp.team?.logo ||
      `https://a.espncdn.com/i/teamlogos/soccer/500/${opp.team?.id || ''}.png`,
    venue,
    round,
  };
}

// ===== 1. Standings =====
async function fetchStandings() {
  console.log('\n[1/5] MLS 컨퍼런스 순위 가져오는 중...');
  const data = await httpsGet(STANDINGS_URL);

  const conferences = data.children || [];
  console.log(`  컨퍼런스 ${conferences.length}개 발견`);

  if (conferences.length === 0) {
    writeJsonSafe('_debug_standings_raw.json', data);
    throw new Error('컨퍼런스 데이터를 찾을 수 없습니다');
  }

  let eastern = [];
  let western = [];

  conferences.forEach((conf) => {
    const confName = (conf.name || conf.displayName || conf.abbreviation || '').toLowerCase();
    const entries = (conf.standings && conf.standings.entries) || conf.entries || [];

    const teams = entries.map((entry, idx) => {
      const team = entry.team || {};
      const stats = entry.stats || [];

      let logo = '';
      if (team.logos && team.logos.length > 0) {
        logo = team.logos[0].href || '';
      }
      if (!logo && team.logo) logo = team.logo;

      return {
        rank: getStatValue(stats, ['rank', 'playoffSeed', 'overall']) || idx + 1,
        team_id: String(team.id || ''),
        team_name: team.displayName || team.name || team.shortDisplayName || '',
        team_short_name: team.shortDisplayName || team.name || '',
        team_abbr: team.abbreviation || '',
        team_logo: logo,
        played: getStatValue(stats, ['gamesPlayed', 'GP']),
        wins: getStatValue(stats, ['wins', 'W']),
        draws: getStatValue(stats, ['ties', 'draws', 'T', 'D']),
        losses: getStatValue(stats, ['losses', 'L']),
        goals_for: getStatValue(stats, ['pointsFor', 'goalsFor', 'GF']),
        goals_against: getStatValue(stats, ['pointsAgainst', 'goalsAgainst', 'GA']),
        goal_diff: getStatValue(stats, ['pointDifferential', 'goalDifferential', 'GD']),
        goal_diff_display: getStatDisplay(stats, ['pointDifferential', 'goalDifferential', 'GD'], '0'),
        points: getStatValue(stats, ['points', 'PTS']),
        recent_form: [], // 아래에서 채워짐
      };
    });

    teams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.goal_diff - a.goal_diff;
    });
    teams.forEach((t, idx) => {
      t.rank = idx + 1;
    });

    if (confName.includes('eastern') || confName.includes('east')) eastern = teams;
    else if (confName.includes('western') || confName.includes('west')) western = teams;
  });

  console.log(`  동부: ${eastern.length}팀, 서부: ${western.length}팀`);
  return { eastern, western };
}

// ===== 2. 각 팀별 schedule =====
// 모든 팀의 최근 schedule을 한 번에 가져와 캐싱
async function fetchAllTeamSchedules(allTeams) {
  console.log(`\n[2/5] 각 팀별 일정 조회 (${allTeams.length}개 팀, 병렬)...`);
  const cache = {}; // team_id → events 배열

  const tasks = allTeams.map((team) => async () => {
    try {
      const data = await httpsGet(TEAM_SCHEDULE_URL(team.team_id), { silent404: true });
      if (!data || !Array.isArray(data.events)) {
        cache[team.team_id] = [];
        return;
      }
      // 시즌 필터 (있으면)
      const events = data.events.filter((ev) => {
        const y = ev.date ? new Date(ev.date).getUTCFullYear() : null;
        return y === null || y === SEASON || y === SEASON - 1;
      });
      cache[team.team_id] = events;
    } catch (e) {
      console.warn(`    WARN: ${team.team_short_name} 일정 실패: ${e.message}`);
      cache[team.team_id] = [];
    }
  });

  await pLimit(tasks, 6);
  const totalEvents = Object.values(cache).reduce((sum, ev) => sum + ev.length, 0);
  console.log(`  팀별 event 총 ${totalEvents}건 수집`);
  return cache;
}

// ===== 3. recent_form 채우기 =====
function enrichStandingsWithForm(standings, scheduleCache) {
  console.log('\n[3/5] 최근 5경기 폼 계산...');
  const all = [...standings.eastern, ...standings.western];
  for (const team of all) {
    const events = scheduleCache[team.team_id] || [];
    const completed = events
      .map((ev) => parseEventForTeam(ev, team.team_id))
      .filter((m) => m && m.completed && m.result)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    // 최근 5경기 (오래된 → 최근 순)
    team.recent_form = completed.slice(-5).map((m) => m.result);
  }
}

// ===== 4. schedule.json (팀별 last/next) =====
function buildScheduleJson(standings, scheduleCache) {
  console.log('\n[4/5] schedule.json 생성...');
  const all = [...standings.eastern, ...standings.western];
  const schedule = {};

  for (const team of all) {
    const events = scheduleCache[team.team_id] || [];
    const parsed = events
      .map((ev) => parseEventForTeam(ev, team.team_id))
      .filter(Boolean);

    const completed = parsed
      .filter((m) => m.completed)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const upcoming = parsed
      .filter((m) => !m.completed && new Date(m.date) > new Date(Date.now() - 4 * 60 * 60 * 1000))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const last = completed[0];
    const next = upcoming[0];

    schedule[team.team_id] = {};
    if (last) {
      schedule[team.team_id].last = {
        match_id: last.match_id,
        date: last.date,
        date_kst: last.date_kst,
        kst_display: last.kst_display,
        home: last.home,
        opponent_id: last.opponent_id,
        opponent_name: last.opponent_name,
        opponent_short: last.opponent_short,
        opponent_logo: last.opponent_logo,
        home_score: last.home_score,
        away_score: last.away_score,
        result: last.result,
        venue: last.venue,
        round: last.round,
      };
    }
    if (next) {
      schedule[team.team_id].next = {
        match_id: next.match_id,
        date: next.date,
        date_kst: next.date_kst,
        kst_display: next.kst_display,
        home: next.home,
        opponent_id: next.opponent_id,
        opponent_name: next.opponent_name,
        opponent_short: next.opponent_short,
        opponent_logo: next.opponent_logo,
        venue: next.venue,
        days_until: daysUntil(next.date),
        round: next.round,
      };
    }
  }

  writeJsonSafe('schedule.json', {
    season: SEASON,
    updated_at: new Date().toISOString(),
    schedule,
  });
}

// ===== 5. 손흥민 + LAFC =====
async function fetchSonAndLAFC(standings, scheduleCache) {
  console.log('\n[5a/5] 손흥민 + LAFC 정보 가져오는 중...');

  const lafcStanding = [...standings.eastern, ...standings.western].find((t) => {
    const name = (t.team_name || '').toLowerCase();
    return (
      name.includes('lafc') ||
      name.includes('los angeles fc') ||
      t.team_id === LAFC_TEAM_ID ||
      t.team_abbr === 'LAFC'
    );
  });

  // LAFC 팀 데이터
  let teamData = null;
  try {
    const data = await httpsGet(LAFC_TEAM_URL);
    teamData = data.team || {};
  } catch (e) {
    console.warn('  LAFC team API 실패:', e.message);
  }

  const teamLogo =
    (teamData?.logos?.[0]?.href) ||
    lafcStanding?.team_logo ||
    'https://a.espncdn.com/i/teamlogos/soccer/500/18966.png';

  const lafcInfo = {
    team_id: teamData?.id || LAFC_TEAM_ID,
    team_name: teamData?.displayName || lafcStanding?.team_name || 'Los Angeles FC',
    team_short_name: teamData?.shortDisplayName || lafcStanding?.team_short_name || 'LAFC',
    team_abbr: teamData?.abbreviation || 'LAFC',
    team_logo: teamLogo,
    venue: teamData?.venue?.fullName || 'BMO Stadium',
    color: teamData?.color ? `#${teamData.color}` : '#000000',
    rank: lafcStanding?.rank ?? null,
    points: lafcStanding?.points ?? null,
    played: lafcStanding?.played ?? null,
    wins: lafcStanding?.wins ?? null,
    draws: lafcStanding?.draws ?? null,
    losses: lafcStanding?.losses ?? null,
    goals_for: lafcStanding?.goals_for ?? null,
    goals_against: lafcStanding?.goals_against ?? null,
    goal_diff: lafcStanding?.goal_diff ?? null,
    goal_diff_display: lafcStanding?.goal_diff_display ?? '0',
    recent_form: lafcStanding?.recent_form ?? [],
  };

  // 손흥민 stats
  console.log('[5b/5] 손흥민 시즌 통계...');
  let sonStats = {};
  let sonRanks = {};
  try {
    const statsData = await httpsGet(ATHLETE_STATS_URL(SON_ATHLETE_ID), { silent404: true });
    if (statsData) {
      // ESPN athlete stats 구조는 복잡하므로 카테고리 순회
      const categories = statsData?.statistics?.splits?.categories || [];
      const allStats = [];
      categories.forEach((cat) => {
        (cat.stats || []).forEach((s) => allStats.push(s));
      });
      sonStats = {
        appearances: getStatValue(allStats, ['appearances', 'totalAppearances', 'GP']),
        goals: getStatValue(allStats, ['totalGoals', 'goals']),
        assists: getStatValue(allStats, ['totalGoalsAssists', 'goalAssists', 'assists']),
        shots: getStatValue(allStats, ['totalShots', 'shots']),
        shots_on_target: getStatValue(allStats, ['shotsOnTarget', 'shotsOnGoal']),
        minutes: getStatValue(allStats, ['totalMinutesPlayed', 'minutesPlayed', 'minutes']),
        yellow_cards: getStatValue(allStats, ['yellowCards']),
        red_cards: getStatValue(allStats, ['redCards']),
      };
    }
  } catch (e) {
    console.warn('  손흥민 stats API 실패:', e.message);
  }

  // 리그 leaders에서 손흥민 골/어시 순위 찾기
  try {
    const leaders = await httpsGet(LEADERS_URL, { silent404: true });
    if (leaders) {
      const cats = leaders?.categories || leaders?.leaders?.categories || [];
      cats.forEach((cat) => {
        const catName = (cat.name || cat.abbreviation || '').toLowerCase();
        const list = cat.leaders || [];
        const idx = list.findIndex((l) => String(l.athlete?.id) === SON_ATHLETE_ID);
        if (idx >= 0) {
          if (catName.includes('goal') && !catName.includes('against')) {
            sonRanks.league_goal_rank = idx + 1;
          } else if (catName.includes('assist')) {
            sonRanks.league_assist_rank = idx + 1;
          }
        }
      });
    }
  } catch (e) {
    console.warn('  leaders API 실패 (손흥민 순위):', e.message);
  }

  // 손흥민 지난/다음 경기: LAFC schedule cache + gamelog 활용
  console.log('[5c/5] 손흥민 지난/다음 경기...');
  let lastMatch = null;
  let nextMatch = null;

  const lafcEvents = scheduleCache[LAFC_TEAM_ID] || [];
  const lafcParsed = lafcEvents
    .map((ev) => parseEventForTeam(ev, LAFC_TEAM_ID))
    .filter(Boolean);
  const lafcCompleted = lafcParsed
    .filter((m) => m.completed)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const lafcUpcoming = lafcParsed
    .filter((m) => !m.completed && new Date(m.date) > new Date(Date.now() - 4 * 60 * 60 * 1000))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (lafcCompleted[0]) {
    const m = lafcCompleted[0];
    lastMatch = {
      match_id: m.match_id,
      date: m.date,
      date_kst: m.date_kst,
      kst_display: m.kst_display,
      competition: 'MLS Regular Season',
      round: m.round || '',
      home: m.home,
      opponent_id: m.opponent_id,
      opponent_name: m.opponent_name,
      opponent_short: m.opponent_short,
      opponent_logo: m.opponent_logo,
      home_score: m.home_score,
      away_score: m.away_score,
      result: m.result,
      venue: m.venue,
      // 손흥민 개인 활약 (gamelog에서 보강)
      son_played: false,
      son_minutes: 0,
      son_goals: 0,
      son_assists: 0,
      son_shots: 0,
      son_rating: null,
      son_man_of_the_match: false,
      summary: '',
    };
  }
  if (lafcUpcoming[0]) {
    const m = lafcUpcoming[0];
    nextMatch = {
      match_id: m.match_id,
      date: m.date,
      date_kst: m.date_kst,
      kst_display: m.kst_display,
      competition: 'MLS Regular Season',
      round: m.round || '',
      home: m.home,
      opponent_id: m.opponent_id,
      opponent_name: m.opponent_name,
      opponent_short: m.opponent_short,
      opponent_logo: m.opponent_logo,
      venue: m.venue,
      days_until: daysUntil(m.date) ?? 0,
      preview: '',
    };
  }

  // 손흥민 gamelog에서 지난 경기 골/어시/출전시간 보강
  try {
    const gl = await httpsGet(ATHLETE_GAMELOG_URL(SON_ATHLETE_ID), { silent404: true });
    if (gl && lastMatch) {
      const events = gl?.events || {};
      // gamelog의 events는 {eventId: {...}} 또는 배열일 수 있음
      const eventList = Array.isArray(events) ? events : Object.values(events);
      const matched = eventList.find(
        (e) => String(e.id) === String(lastMatch.match_id) ||
              String(e.eventId) === String(lastMatch.match_id)
      );
      if (matched) {
        // gamelog stats 배열은 카테고리 순서에 따라 다름
        // 가장 일반적인 순서: [goals, assists, shots, shots_on_target, ..., minutes, ...]
        const stats = matched.stats || [];
        const labels = matched.statLabels || gl?.names || [];
        // 라벨로 매핑 시도
        const findByLabel = (...keys) => {
          for (const key of keys) {
            const idx = labels.findIndex(
              (l) => String(l).toLowerCase().includes(key)
            );
            if (idx >= 0) {
              const v = parseFloat(stats[idx]);
              if (!isNaN(v)) return v;
            }
          }
          return null;
        };
        const goals = findByLabel('goal');
        const assists = findByLabel('assist');
        const shots = findByLabel('shot');
        const minutes = findByLabel('minute', 'min');
        if (goals !== null) lastMatch.son_goals = goals;
        if (assists !== null) lastMatch.son_assists = assists;
        if (shots !== null) lastMatch.son_shots = shots;
        if (minutes !== null) {
          lastMatch.son_minutes = minutes;
          lastMatch.son_played = minutes > 0;
        }
        // MOTM 판단: 골 2개 이상이거나 (1골 + 1어시)
        if ((lastMatch.son_goals >= 2) ||
            (lastMatch.son_goals >= 1 && lastMatch.son_assists >= 1)) {
          lastMatch.son_man_of_the_match = true;
        }
        // 자동 요약문
        if (lastMatch.son_goals > 0 || lastMatch.son_assists > 0) {
          const parts = [];
          if (lastMatch.son_goals > 0) parts.push(`${lastMatch.son_goals}골`);
          if (lastMatch.son_assists > 0) parts.push(`${lastMatch.son_assists}어시`);
          lastMatch.summary = `손흥민이 ${parts.join(' ')}를 기록하며 팀 ${lastMatch.result === 'W' ? '승리' : lastMatch.result === 'L' ? '패배' : '무승부'}에 기여했습니다.`;
        }
      }
    }
  } catch (e) {
    console.warn('  gamelog 보강 실패:', e.message);
  }

  const sonInfo = {
    player_name: 'Heung-Min Son',
    player_name_ko: '손흥민',
    nationality: 'South Korea',
    nationality_ko: '대한민국',
    team_name: 'Los Angeles FC',
    team_short_name: 'LAFC',
    position: 'Forward',
    position_ko: '공격수',
    jersey: '7',
    age: 33,
    photo: 'https://a.espncdn.com/i/headshots/soccer/players/full/178194.png',
    transfer_note: '2025년 여름 토트넘에서 LAFC로 이적',
    transfer_note_en: 'Joined LAFC from Tottenham Hotspur in summer 2025',
    season: SEASON,
    // 시즌 누적 스탯
    appearances: sonStats.appearances ?? null,
    goals: sonStats.goals ?? null,
    assists: sonStats.assists ?? null,
    shots: sonStats.shots ?? null,
    shots_on_target: sonStats.shots_on_target ?? null,
    minutes: sonStats.minutes ?? null,
    yellow_cards: sonStats.yellow_cards ?? null,
    red_cards: sonStats.red_cards ?? null,
    goals_per_match:
      sonStats.appearances && sonStats.appearances > 0
        ? Number(((sonStats.goals || 0) / sonStats.appearances).toFixed(2))
        : null,
    league_goal_rank: sonRanks.league_goal_rank ?? null,
    league_assist_rank: sonRanks.league_assist_rank ?? null,
  };

  writeJsonSafe('son.json', {
    season: SEASON,
    updated_at: new Date().toISOString(),
    lafc: lafcInfo,
    son: sonInfo,
    last_match: lastMatch,
    next_match: nextMatch,
  });

  console.log(
    `  LAFC: ${lafcInfo.rank || '?'}위 / 손흥민: ${sonInfo.goals ?? '?'}골 ${sonInfo.assists ?? '?'}어시`
  );
}

// ===== 6. scorers.json (득점/어시스트 순위) =====
async function fetchScorers() {
  console.log('\n[5d/5] 득점/어시스트 순위 가져오는 중...');

  let scorers = [];
  let assisters = [];

  try {
    const leaders = await httpsGet(LEADERS_URL, { silent404: true });
    if (leaders) {
      const cats = leaders?.categories || leaders?.leaders?.categories || [];

      const goalCat = cats.find((c) => {
        const n = (c.name || c.abbreviation || '').toLowerCase();
        return (n.includes('goal') && !n.includes('against')) || n === 'totalgoals' || n === 'g';
      });
      const assistCat = cats.find((c) => {
        const n = (c.name || c.abbreviation || '').toLowerCase();
        return n.includes('assist');
      });

      const mapLeader = (l, idx, statKey) => {
        const a = l.athlete || {};
        const t = l.team || a.team || {};
        const teamLogo =
          (t.logos && t.logos[0]?.href) ||
          t.logo ||
          (t.id ? `https://a.espncdn.com/i/teamlogos/soccer/500/${t.id}.png` : '');
        const value = Number(l.value ?? l.displayValue ?? 0);
        const base = {
          rank: idx + 1,
          player_id: String(a.id || ''),
          player_name: a.displayName || a.fullName || a.shortName || '',
          player_name_ko: String(a.id) === SON_ATHLETE_ID ? '손흥민' : '',
          nationality: a.flag?.alt || a.birthPlace?.country || '',
          team_id: String(t.id || ''),
          team_name: t.displayName || t.name || '',
          team_short: t.shortDisplayName || t.abbreviation || '',
          team_logo: teamLogo,
          played: 0, // ESPN leaders는 played를 안 주는 경우가 많음
          [statKey]: value,
        };
        if (statKey === 'goals') {
          base.penalties = 0;
        }
        return base;
      };

      if (goalCat?.leaders) {
        scorers = goalCat.leaders.slice(0, 10).map((l, i) => mapLeader(l, i, 'goals'));
      }
      if (assistCat?.leaders) {
        assisters = assistCat.leaders.slice(0, 10).map((l, i) => mapLeader(l, i, 'assists'));
      }
    }
  } catch (e) {
    console.warn('  leaders API 실패:', e.message);
  }

  writeJsonSafe('scorers.json', {
    season: SEASON,
    updated_at: new Date().toISOString(),
    scorers,
    assisters,
  });

  console.log(`  득점왕 Top: ${scorers[0]?.player_name || '?'} ${scorers[0]?.goals || '?'}골`);
  console.log(`  도움왕 Top: ${assisters[0]?.player_name || '?'} ${assisters[0]?.assists || '?'}도움`);
}

// ===== 7. meta.json =====
function writeMeta() {
  writeJsonSafe('meta.json', {
    season: SEASON,
    league_name: 'Major League Soccer',
    league_abbr: 'MLS',
    league_name_ko: '메이저리그 사커',
    updated_at: new Date().toISOString(),
    source: 'ESPN (unofficial)',
    version: '3.0',
  });
}

// ===== 8. 최종 standings.json 쓰기 =====
function writeStandings(standings) {
  writeJsonSafe('standings.json', {
    season: SEASON,
    updated_at: new Date().toISOString(),
    eastern: standings.eastern,
    western: standings.western,
  });
}

// ===== 메인 =====
(async () => {
  console.log('==============================================');
  console.log('MLS 순위 앱 데이터 수집 v3.0 (ESPN API)');
  console.log(`시각: ${new Date().toISOString()}`);
  console.log('==============================================');

  try {
    // 1. 순위
    const standings = await fetchStandings();

    // 2. 모든 팀 일정 (병렬)
    const allTeams = [...standings.eastern, ...standings.western];
    const scheduleCache = await fetchAllTeamSchedules(allTeams);

    // 3. recent_form 채우기
    enrichStandingsWithForm(standings, scheduleCache);

    // 4. standings.json 쓰기 (form 포함된 최종본)
    writeStandings(standings);

    // 5. schedule.json
    buildScheduleJson(standings, scheduleCache);

    // 6. son.json (LAFC + 손흥민)
    await fetchSonAndLAFC(standings, scheduleCache);

    // 7. scorers.json
    await fetchScorers();

    // 8. meta.json
    writeMeta();

    console.log('\n==============================================');
    console.log('OK: 모든 데이터 수집 완료');
    console.log('  - data/standings.json');
    console.log('  - data/schedule.json');
    console.log('  - data/son.json');
    console.log('  - data/scorers.json');
    console.log('  - data/meta.json');
    console.log('==============================================');
    process.exit(0);
  } catch (error) {
    console.error('\n==============================================');
    console.error('ERROR:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
    console.error('==============================================');
    process.exit(1);
  }
})();
