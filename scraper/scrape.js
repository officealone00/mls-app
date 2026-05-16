// MLS 순위 앱 데이터 스크래퍼 - ESPN 비공식 API
// 매일 GitHub Actions에서 자동 실행
// v4.0 - 개선판: leaders API 다중 시도 + 손흥민 동적 탐지 + 코리안리거 자동 수집 + 예상 스코어
//
// 출력 파일:
//   - data/standings.json   (순위 + 최근 5경기 폼)
//   - data/son.json         (LAFC + 손흥민 통계 + 지난/다음 경기)
//   - data/scorers.json     (MLS 득점/어시스트 순위)
//   - data/schedule.json    (각 팀의 last/next 경기 + 상대팀 스탯)
//   - data/koreans.json     (MLS의 한국 국적 선수 목록)
//   - data/meta.json        (메타 정보)

const fs = require('fs');
const path = require('path');
const https = require('https');

// ===== ESPN API 엔드포인트 =====
const SEASON = 2026;

const STANDINGS_URL = `https://site.web.api.espn.com/apis/v2/sports/soccer/usa.1/standings?level=3&season=${SEASON}`;
const LAFC_TEAM_ID = '18966';

// 손흥민 ESPN athlete ID 후보. roster 스캔으로 동적 탐지하되, 못 찾으면 첫 번째 fallback
const SON_ATHLETE_ID_CANDIDATES = ['178194', '4486394'];

const LAFC_TEAM_URL = `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/teams/${LAFC_TEAM_ID}`;
const TEAM_SCHEDULE_URL = (teamId) =>
  `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/teams/${teamId}/schedule?season=${SEASON}`;
const TEAM_ROSTER_URL = (teamId) =>
  `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/teams/${teamId}/roster`;

// leaders API는 시즌/타입별로 endpoint를 다양하게 시도
const LEADERS_URL_CANDIDATES = [
  `https://site.web.api.espn.com/apis/site/v2/sports/soccer/usa.1/leaders?lang=en&region=us&season=${SEASON}&seasontype=1`,
  `https://site.web.api.espn.com/apis/site/v2/sports/soccer/usa.1/leaders?lang=en&region=us&season=${SEASON}`,
  `https://site.web.api.espn.com/apis/site/v2/sports/soccer/usa.1/leaders?lang=en&region=us`,
  `https://site.web.api.espn.com/apis/v2/sports/soccer/usa.1/leaders?season=${SEASON}`,
];

const ATHLETE_STATS_URL = (id) =>
  `https://site.web.api.espn.com/apis/common/v3/sports/soccer/usa.1/athletes/${id}/statistics?season=${SEASON}`;
const ATHLETE_GAMELOG_URL = (id) =>
  `https://site.web.api.espn.com/apis/common/v3/sports/soccer/usa.1/athletes/${id}/gamelog?season=${SEASON}`;

const DATA_DIR = path.join(__dirname, '..', 'data');

// ===== HTTP 유틸 =====
function httpsGet(url, { silent404 = false, silentAll = false } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; mls-app-scraper/4.0)',
          Accept: 'application/json',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString();
          if (res.statusCode !== 200) {
            if (silentAll) return resolve(null);
            if (silent404 && res.statusCode === 404) return resolve(null);
            return reject(new Error(`HTTP ${res.statusCode}: ${body.substring(0, 300)}`));
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            if (silentAll) return resolve(null);
            reject(new Error(`JSON parse failed: ${body.substring(0, 300)}`));
          }
        });
      }
    );
    req.on('error', (err) => {
      if (silentAll) return resolve(null);
      reject(err);
    });
    req.setTimeout(30000, () => req.destroy(new Error('Request timeout')));
  });
}

// 동시 호출 제한
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

  const homeAway = me.homeAway;
  const isHome = homeAway === 'home';

  const venue = comp.venue?.fullName || comp.venue?.shortName || '';
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
  console.log('\n[1/7] MLS 컨퍼런스 순위 가져오는 중...');
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
        recent_form: [],
      };
    });

    teams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.goal_diff - a.goal_diff;
    });
    teams.forEach((t, idx) => { t.rank = idx + 1; });

    if (confName.includes('eastern') || confName.includes('east')) eastern = teams;
    else if (confName.includes('western') || confName.includes('west')) western = teams;
  });

  console.log(`  동부: ${eastern.length}팀, 서부: ${western.length}팀`);
  return { eastern, western };
}

// ===== 2. 각 팀별 schedule =====
async function fetchAllTeamSchedules(allTeams) {
  console.log(`\n[2/7] 각 팀별 일정 조회 (${allTeams.length}개 팀, 병렬)...`);
  const cache = {};
  const tasks = allTeams.map((team) => async () => {
    try {
      const data = await httpsGet(TEAM_SCHEDULE_URL(team.team_id), { silent404: true });
      if (!data || !Array.isArray(data.events)) {
        cache[team.team_id] = [];
        return;
      }
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

// ===== 3. recent_form =====
function enrichStandingsWithForm(standings, scheduleCache) {
  console.log('\n[3/7] 최근 5경기 폼 계산...');
  const all = [...standings.eastern, ...standings.western];
  for (const team of all) {
    const events = scheduleCache[team.team_id] || [];
    const completed = events
      .map((ev) => parseEventForTeam(ev, team.team_id))
      .filter((m) => m && m.completed && m.result)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    team.recent_form = completed.slice(-5).map((m) => m.result);
  }
}

// ===== 4. schedule.json (상대팀 stats 포함 - 예상 스코어용) =====
function buildScheduleJson(standings, scheduleCache) {
  console.log('\n[4/7] schedule.json 생성 (상대팀 stats 포함)...');
  const all = [...standings.eastern, ...standings.western];
  const allById = {};
  all.forEach((t) => { allById[t.team_id] = t; });

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
      const oppRow = allById[next.opponent_id];
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
        // 상대팀 stats (예상 스코어 계산용)
        opponent_stats: oppRow
          ? {
              rank: oppRow.rank,
              points: oppRow.points,
              played: oppRow.played,
              wins: oppRow.wins,
              draws: oppRow.draws,
              losses: oppRow.losses,
              goals_for: oppRow.goals_for,
              goals_against: oppRow.goals_against,
              recent_form: oppRow.recent_form || [],
            }
          : null,
      };
    }
  }

  writeJsonSafe('schedule.json', {
    season: SEASON,
    updated_at: new Date().toISOString(),
    schedule,
  });
}

// ===== 5. 한국선수 탐지 + 손흥민 ID 확정 =====
async function findKoreanPlayersAndSon(allTeams) {
  console.log('\n[5/7] 코리안리거 자동 탐지 (각 팀 roster 스캔)...');

  const koreans = [];
  let sonAthleteId = null;

  const rosterTasks = allTeams.map((team) => async () => {
    try {
      const data = await httpsGet(TEAM_ROSTER_URL(team.team_id), { silentAll: true });
      if (!data) return;
      const athletes = data.athletes || [];
      const list = Array.isArray(athletes) ? athletes : Object.values(athletes);
      const flatten = [];
      list.forEach((it) => {
        if (it.items) flatten.push(...it.items);
        else if (it.athlete) flatten.push(it.athlete);
        else flatten.push(it);
      });

      flatten.forEach((a) => {
        if (!a) return;
        const flagAlt = a.flag?.alt || a.flag?.name || '';
        const country = a.birthPlace?.country || a.citizenship || '';
        const displayName = a.displayName || a.fullName || a.shortName || '';

        const isKorean =
          /korea/i.test(flagAlt) ||
          /korea/i.test(country) ||
          flagAlt === 'KR' ||
          country === 'KR' ||
          /heung[- ]?min/i.test(displayName) ||
          SON_ATHLETE_ID_CANDIDATES.includes(String(a.id));

        if (isKorean) {
          const isSon = /heung[- ]?min/i.test(displayName) || SON_ATHLETE_ID_CANDIDATES.includes(String(a.id));
          const koreanName =
            isSon ? '손흥민' :
            /jeong[- ]?sang[- ]?bin|sang[- ]?bin[- ]?jeong/i.test(displayName) ? '정상빈' :
            /paik[- ]?seung[- ]?ho/i.test(displayName) ? '백승호' :
            /hwang[- ]?in[- ]?beom/i.test(displayName) ? '황인범' :
            /kim[- ]?kee[- ]?hee|kee[- ]?hee[- ]?kim/i.test(displayName) ? '김기희' :
            /cho[- ]?young[- ]?wook|young[- ]?wook[- ]?cho/i.test(displayName) ? '조영욱' :
            /hwang[- ]?ui[- ]?jo/i.test(displayName) ? '황의조' :
            /lee[- ]?kang[- ]?in/i.test(displayName) ? '이강인' :
            '';

          koreans.push({
            player_id: String(a.id || ''),
            player_name: displayName,
            player_name_ko: koreanName,
            position: a.position?.displayName || a.position?.name || '',
            jersey: String(a.jersey || a.uniformNumber || ''),
            age: a.age || null,
            photo: a.headshot?.href || (a.id ? `https://a.espncdn.com/i/headshots/soccer/players/full/${a.id}.png` : ''),
            team_id: team.team_id,
            team_name: team.team_name,
            team_short: team.team_short_name,
            team_logo: team.team_logo,
            appearances: null,
            goals: null,
            assists: null,
            shots: null,
            shots_on_target: null,
            minutes: null,
            is_son: isSon,
          });
          if (isSon) sonAthleteId = String(a.id);
        }
      });
    } catch (e) {
      // 무시
    }
  });
  await pLimit(rosterTasks, 6);

  if (!sonAthleteId) {
    sonAthleteId = SON_ATHLETE_ID_CANDIDATES[0];
    console.log(`  손흥민 ID 자동 탐지 실패. fallback ID 사용: ${sonAthleteId}`);
  } else {
    console.log(`  손흥민 ID 발견: ${sonAthleteId}`);
  }
  console.log(`  코리안리거 ${koreans.length}명 발견`);

  return { koreans, sonAthleteId };
}

async function enrichKoreanStats(koreans) {
  console.log('\n[5b] 코리안리거 시즌 통계 보강...');
  const tasks = koreans.map((p) => async () => {
    if (!p.player_id) return;
    try {
      const data = await httpsGet(ATHLETE_STATS_URL(p.player_id), { silentAll: true });
      if (!data) return;
      const categories = data?.statistics?.splits?.categories || [];
      const allStats = [];
      categories.forEach((cat) => {
        (cat.stats || []).forEach((s) => allStats.push(s));
      });
      p.appearances = getStatValue(allStats, ['appearances', 'totalAppearances', 'GP']) || null;
      p.goals = getStatValue(allStats, ['totalGoals', 'goals']) || 0;
      p.assists = getStatValue(allStats, ['totalGoalsAssists', 'goalAssists', 'assists']) || 0;
      p.shots = getStatValue(allStats, ['totalShots', 'shots']) || 0;
      p.shots_on_target = getStatValue(allStats, ['shotsOnTarget', 'shotsOnGoal']) || 0;
      p.minutes = getStatValue(allStats, ['totalMinutesPlayed', 'minutesPlayed', 'minutes']) || 0;
    } catch (e) {
      // 무시
    }
  });
  await pLimit(tasks, 4);
}

// ===== 6. 손흥민 + LAFC =====
async function fetchSonAndLAFC(standings, scheduleCache, sonAthleteId, koreans) {
  console.log('\n[6/7] 손흥민 + LAFC 정보 가져오는 중...');

  const lafcStanding = [...standings.eastern, ...standings.western].find((t) => {
    const name = (t.team_name || '').toLowerCase();
    return (
      name.includes('lafc') ||
      name.includes('los angeles fc') ||
      t.team_id === LAFC_TEAM_ID ||
      t.team_abbr === 'LAFC'
    );
  });

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

  // 손흥민 stats: koreans에서 먼저 찾고, 없으면 별도 호출
  const sonFromKoreans = koreans.find((k) => k.is_son || k.player_id === sonAthleteId);
  let sonStats = {};
  if (sonFromKoreans) {
    sonStats = {
      appearances: sonFromKoreans.appearances,
      goals: sonFromKoreans.goals,
      assists: sonFromKoreans.assists,
      shots: sonFromKoreans.shots,
      shots_on_target: sonFromKoreans.shots_on_target,
      minutes: sonFromKoreans.minutes,
    };
  } else {
    try {
      const statsData = await httpsGet(ATHLETE_STATS_URL(sonAthleteId), { silentAll: true });
      if (statsData) {
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
  }

  // leaders에서 손흥민 순위 찾기 (다중 URL 시도)
  let sonRanks = {};
  for (const url of LEADERS_URL_CANDIDATES) {
    try {
      const leaders = await httpsGet(url, { silentAll: true });
      if (!leaders) continue;
      const cats = leaders?.categories || leaders?.leaders?.categories || [];
      if (cats.length === 0) continue;
      let found = false;
      cats.forEach((cat) => {
        const catName = (cat.name || cat.abbreviation || '').toLowerCase();
        const list = cat.leaders || [];
        const idx = list.findIndex(
          (l) => String(l.athlete?.id) === sonAthleteId ||
                 SON_ATHLETE_ID_CANDIDATES.includes(String(l.athlete?.id))
        );
        if (idx >= 0) {
          found = true;
          if (catName.includes('goal') && !catName.includes('against')) {
            sonRanks.league_goal_rank = idx + 1;
          } else if (catName.includes('assist')) {
            sonRanks.league_assist_rank = idx + 1;
          }
        }
      });
      if (found || cats.length > 0) break;
    } catch (e) {}
  }

  // 지난/다음 경기
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

  // gamelog 보강
  try {
    const gl = await httpsGet(ATHLETE_GAMELOG_URL(sonAthleteId), { silentAll: true });
    if (gl && lastMatch) {
      const events = gl?.events || {};
      const eventList = Array.isArray(events) ? events : Object.values(events);
      const matched = eventList.find(
        (e) => String(e.id) === String(lastMatch.match_id) ||
              String(e.eventId) === String(lastMatch.match_id)
      );
      if (matched) {
        const stats = matched.stats || [];
        const labels = matched.statLabels || gl?.names || [];
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
        if ((lastMatch.son_goals >= 2) ||
            (lastMatch.son_goals >= 1 && lastMatch.son_assists >= 1)) {
          lastMatch.son_man_of_the_match = true;
        }
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
    photo: `https://a.espncdn.com/i/headshots/soccer/players/full/${sonAthleteId}.png`,
    transfer_note: '2025년 여름 토트넘에서 LAFC로 이적',
    transfer_note_en: 'Joined LAFC from Tottenham Hotspur in summer 2025',
    season: SEASON,
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

// ===== 7. scorers.json (다중 URL 시도) =====
async function fetchScorers() {
  console.log('\n[7/7] 득점/어시스트 순위 가져오는 중...');

  let scorers = [];
  let assisters = [];

  for (const url of LEADERS_URL_CANDIDATES) {
    try {
      const leaders = await httpsGet(url, { silentAll: true });
      if (!leaders) continue;

      const cats = leaders?.categories || leaders?.leaders?.categories || [];
      if (cats.length === 0) continue;

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
        const flagAlt = a.flag?.alt || a.flag?.name || '';
        const isKR =
          /korea/i.test(flagAlt) ||
          /heung[- ]?min/i.test(a.displayName || '') ||
          SON_ATHLETE_ID_CANDIDATES.includes(String(a.id));
        const base = {
          rank: idx + 1,
          player_id: String(a.id || ''),
          player_name: a.displayName || a.fullName || a.shortName || '',
          player_name_ko: isKR && /heung[- ]?min/i.test(a.displayName || '')
            ? '손흥민'
            : '',
          nationality: flagAlt || a.birthPlace?.country || '',
          team_id: String(t.id || ''),
          team_name: t.displayName || t.name || '',
          team_short: t.shortDisplayName || t.abbreviation || '',
          team_logo: teamLogo,
          played: 0,
          [statKey]: value,
        };
        if (statKey === 'goals') {
          base.penalties = 0;
        }
        return base;
      };

      if (goalCat?.leaders && goalCat.leaders.length > 0) {
        scorers = goalCat.leaders.slice(0, 15).map((l, i) => mapLeader(l, i, 'goals'));
      }
      if (assistCat?.leaders && assistCat.leaders.length > 0) {
        assisters = assistCat.leaders.slice(0, 15).map((l, i) => mapLeader(l, i, 'assists'));
      }

      if (scorers.length > 0 || assisters.length > 0) break;
    } catch (e) {
      console.warn(`  leaders API 시도 실패:`, e.message);
    }
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

// ===== 8. koreans.json =====
function writeKoreans(koreans) {
  // is_son 필드 정리
  const cleaned = koreans.map(({ is_son, ...rest }) => rest);
  writeJsonSafe('koreans.json', {
    season: SEASON,
    updated_at: new Date().toISOString(),
    players: cleaned,
  });
  console.log(`  코리안리거 ${cleaned.length}명 기록`);
}

function writeMeta() {
  writeJsonSafe('meta.json', {
    season: SEASON,
    league_name: 'Major League Soccer',
    league_abbr: 'MLS',
    league_name_ko: '메이저리그 사커',
    updated_at: new Date().toISOString(),
    source: 'ESPN (unofficial)',
    version: '4.0',
  });
}

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
  console.log('MLS 순위 앱 데이터 수집 v4.0 (ESPN API)');
  console.log(`시각: ${new Date().toISOString()}`);
  console.log('==============================================');

  try {
    const standings = await fetchStandings();
    const allTeams = [...standings.eastern, ...standings.western];
    const scheduleCache = await fetchAllTeamSchedules(allTeams);
    enrichStandingsWithForm(standings, scheduleCache);
    writeStandings(standings);
    buildScheduleJson(standings, scheduleCache);

    const { koreans, sonAthleteId } = await findKoreanPlayersAndSon(allTeams);
    await enrichKoreanStats(koreans);
    writeKoreans(koreans);

    await fetchSonAndLAFC(standings, scheduleCache, sonAthleteId, koreans);
    await fetchScorers();
    writeMeta();

    console.log('\n==============================================');
    console.log('OK: 모든 데이터 수집 완료');
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
