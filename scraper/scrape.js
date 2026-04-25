// MLS 순위 앱 데이터 스크래퍼 - ESPN 비공식 API
// 매일 GitHub Actions에서 자동 실행
// v2.0 - ESPN 기반

const fs = require('fs');
const path = require('path');
const https = require('https');

// ===== ESPN API 엔드포인트 =====
const STANDINGS_URL = 'https://site.web.api.espn.com/apis/v2/sports/soccer/usa.1/standings?level=3';
const LAFC_TEAM_ID = '18966';
const LAFC_TEAM_URL = `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/teams/${LAFC_TEAM_ID}`;

const DATA_DIR = path.join(__dirname, '..', 'data');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; mls-app-scraper/1.0)',
          Accept: 'application/json',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString();
          if (res.statusCode !== 200) {
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

async function fetchStandings() {
  console.log('\n[1/2] MLS 컨퍼런스 순위 가져오는 중...');
  const data = await httpsGet(STANDINGS_URL);

  console.log(`  응답 keys: ${Object.keys(data || {}).join(', ')}`);

  const conferences = data.children || [];
  console.log(`  컨퍼런스 ${conferences.length}개 발견`);

  if (conferences.length === 0) {
    writeJsonSafe('_debug_standings_raw.json', data);
    throw new Error('컨퍼런스 데이터를 찾을 수 없습니다 (children 배열 비어있음)');
  }

  let eastern = [];
  let western = [];
  let unmatched = [];

  conferences.forEach((conf) => {
    const confName = (conf.name || conf.displayName || conf.abbreviation || '').toLowerCase();
    console.log(`  - 컨퍼런스: "${conf.name || conf.displayName}" (${conf.abbreviation || '?'})`);

    const entries = (conf.standings && conf.standings.entries) || conf.entries || [];
    console.log(`    팀 ${entries.length}개`);

    const teams = entries.map((entry, idx) => {
      const team = entry.team || {};
      const stats = entry.stats || [];

      let logo = '';
      if (team.logos && team.logos.length > 0) {
        logo = team.logos[0].href || '';
      }
      if (!logo && team.logo) {
        logo = team.logo;
      }

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

    if (confName.includes('eastern') || confName.includes('east')) {
      eastern = teams;
    } else if (confName.includes('western') || confName.includes('west')) {
      western = teams;
    } else {
      unmatched.push({ name: conf.name, teams });
    }
  });

  if (unmatched.length > 0) {
    console.warn(`  WARN: 미분류 컨퍼런스 ${unmatched.length}개`);
    writeJsonSafe('_debug_unmatched.json', unmatched);
  }

  console.log(`  동부: ${eastern.length}팀, 서부: ${western.length}팀`);
  if (eastern[0]) console.log(`  동부 1위: ${eastern[0].team_name} (${eastern[0].points}점)`);
  if (western[0]) console.log(`  서부 1위: ${western[0].team_name} (${western[0].points}점)`);

  writeJsonSafe('standings.json', {
    season: 2026,
    updated_at: new Date().toISOString(),
    eastern,
    western,
  });

  return { eastern, western };
}

async function fetchSonHeungMin(westernTeams) {
  console.log('\n[2/2] LAFC + 손흥민 정보 가져오는 중...');

  const lafcStanding = westernTeams.find((t) => {
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
    console.log(`  LAFC team API: ${teamData.displayName || teamData.name}`);
  } catch (e) {
    console.warn('  LAFC team API 실패:', e.message);
  }

  const teamLogo =
    (teamData && teamData.logos && teamData.logos[0] && teamData.logos[0].href) ||
    (lafcStanding && lafcStanding.team_logo) ||
    'https://a.espncdn.com/i/teamlogos/soccer/500/18966.png';

  const lafcInfo = {
    team_id: (teamData && teamData.id) || LAFC_TEAM_ID,
    team_name: (teamData && teamData.displayName) || (lafcStanding && lafcStanding.team_name) || 'Los Angeles FC',
    team_short_name: (teamData && teamData.shortDisplayName) || (lafcStanding && lafcStanding.team_short_name) || 'LAFC',
    team_abbr: (teamData && teamData.abbreviation) || 'LAFC',
    team_logo: teamLogo,
    venue: teamData && teamData.venue ? teamData.venue.fullName : 'BMO Stadium',
    color: teamData ? `#${teamData.color || '000000'}` : '#000000',
    rank: lafcStanding ? lafcStanding.rank : null,
    points: lafcStanding ? lafcStanding.points : null,
    played: lafcStanding ? lafcStanding.played : null,
    wins: lafcStanding ? lafcStanding.wins : null,
    draws: lafcStanding ? lafcStanding.draws : null,
    losses: lafcStanding ? lafcStanding.losses : null,
    goals_for: lafcStanding ? lafcStanding.goals_for : null,
    goals_against: lafcStanding ? lafcStanding.goals_against : null,
    goal_diff: lafcStanding ? lafcStanding.goal_diff : null,
    goal_diff_display: lafcStanding ? lafcStanding.goal_diff_display : '0',
  };

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
    season: 2026,
  };

  writeJsonSafe('son.json', {
    season: 2026,
    updated_at: new Date().toISOString(),
    lafc: lafcInfo,
    son: sonInfo,
  });

  console.log(`  LAFC: 서부 ${lafcInfo.rank || '?'}위, ${lafcInfo.points || 0}점`);
}

function writeMeta() {
  writeJsonSafe('meta.json', {
    season: 2026,
    league_name: 'Major League Soccer',
    league_abbr: 'MLS',
    league_name_ko: '메이저리그 사커',
    updated_at: new Date().toISOString(),
    source: 'ESPN (unofficial)',
    version: '2.0',
  });
}

(async () => {
  console.log('==============================================');
  console.log('MLS 순위 앱 데이터 수집 (ESPN API)');
  console.log(`시각: ${new Date().toISOString()}`);
  console.log('==============================================');

  try {
    const { eastern, western } = await fetchStandings();
    await fetchSonHeungMin(western);
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