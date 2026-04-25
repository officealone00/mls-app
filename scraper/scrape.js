// MLS 순위 앱 데이터 스크래퍼
// 데이터 출처: API-Football (api-sports.io)
// 매일 GitHub Actions에서 자동 실행
// v1.0

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_HOST = 'v3.football.api-sports.io';
const LEAGUE_ID = 253; // MLS
const SEASON = 2026;

// 데이터 디렉토리 (GitHub Pages로 서빙)
const DATA_DIR = path.join(__dirname, '..', 'data');

if (!API_KEY) {
  console.error('ERROR: API_FOOTBALL_KEY 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

// API 호출 헬퍼
function apiGet(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      hostname: API_HOST,
      path: endpoint,
      headers: {
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': API_HOST,
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        try {
          const json = JSON.parse(body);
          if (json.errors && Object.keys(json.errors).length > 0) {
            console.warn(`API 경고 [${endpoint}]:`, json.errors);
          }
          resolve(json);
        } catch (e) {
          reject(new Error(`JSON 파싱 실패: ${body.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('Timeout'));
    });
    req.end();
  });
}

// 안전한 파일 쓰기 (임시 파일 → 원본 교체)
function writeJsonSafe(filename, data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const fullPath = path.join(DATA_DIR, filename);
  const tmpPath = fullPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, fullPath);
  console.log(`  -> ${filename} 저장 (${JSON.stringify(data).length} bytes)`);
}

// 1. 컨퍼런스 순위 가져오기
async function fetchStandings() {
  console.log('\n[1/4] MLS 순위 가져오는 중...');
  const data = await apiGet(`/standings?league=${LEAGUE_ID}&season=${SEASON}`);

  if (!data.response || data.response.length === 0) {
    throw new Error('순위 데이터 없음');
  }

  const standingsGroups = data.response[0].league.standings; // [[동부 팀들...], [서부 팀들...]]
  const eastern = [];
  const western = [];

  standingsGroups.forEach((group) => {
    group.forEach((team) => {
      const teamData = {
        rank: team.rank,
        team_id: team.team.id,
        team_name: team.team.name,
        team_logo: team.team.logo,
        played: team.all.played,
        wins: team.all.win,
        draws: team.all.draw,
        losses: team.all.lose,
        goals_for: team.all.goals.for,
        goals_against: team.all.goals.against,
        goal_diff: team.goalsDiff,
        points: team.points,
        form: team.form,           // "WWLDW" 같은 최근 5경기
        description: team.description, // "Promotion - MLS Cup Playoffs (Round 1)" 등
        group: team.group,         // "Eastern Conference" / "Western Conference"
      };

      if (team.group && team.group.toLowerCase().includes('eastern')) {
        eastern.push(teamData);
      } else if (team.group && team.group.toLowerCase().includes('western')) {
        western.push(teamData);
      } else {
        // group 정보가 없으면 기본 분류 시도
        console.warn('  group 미지정:', team.team.name, team.group);
      }
    });
  });

  // 컨퍼런스별로 rank 재정렬
  eastern.sort((a, b) => a.rank - b.rank);
  western.sort((a, b) => a.rank - b.rank);

  console.log(`  동부: ${eastern.length}팀, 서부: ${western.length}팀`);

  writeJsonSafe('standings.json', {
    season: SEASON,
    updated_at: new Date().toISOString(),
    eastern,
    western,
  });

  return { eastern, western };
}

// 2. 득점 순위
async function fetchTopScorers() {
  console.log('\n[2/4] 득점 순위 가져오는 중...');
  const data = await apiGet(`/players/topscorers?league=${LEAGUE_ID}&season=${SEASON}`);

  if (!data.response) {
    throw new Error('득점 데이터 없음');
  }

  const scorers = data.response.slice(0, 30).map((item, idx) => {
    const stats = (item.statistics && item.statistics[0]) || {};
    return {
      rank: idx + 1,
      player_id: item.player.id,
      player_name: item.player.name,
      player_photo: item.player.photo,
      nationality: item.player.nationality,
      team_id: stats.team ? stats.team.id : null,
      team_name: stats.team ? stats.team.name : '',
      team_logo: stats.team ? stats.team.logo : '',
      goals: (stats.goals && stats.goals.total) || 0,
      assists: (stats.goals && stats.goals.assists) || 0,
      games: (stats.games && stats.games.appearences) || 0,
      minutes: (stats.games && stats.games.minutes) || 0,
    };
  });

  console.log(`  TOP ${scorers.length}: 1위 ${scorers[0]?.player_name} (${scorers[0]?.goals}골)`);

  writeJsonSafe('scorers.json', {
    season: SEASON,
    updated_at: new Date().toISOString(),
    players: scorers,
  });

  return scorers;
}

// 3. 도움 순위
async function fetchTopAssists() {
  console.log('\n[3/4] 도움 순위 가져오는 중...');
  const data = await apiGet(`/players/topassists?league=${LEAGUE_ID}&season=${SEASON}`);

  if (!data.response) {
    throw new Error('도움 데이터 없음');
  }

  const assists = data.response.slice(0, 30).map((item, idx) => {
    const stats = (item.statistics && item.statistics[0]) || {};
    return {
      rank: idx + 1,
      player_id: item.player.id,
      player_name: item.player.name,
      player_photo: item.player.photo,
      nationality: item.player.nationality,
      team_id: stats.team ? stats.team.id : null,
      team_name: stats.team ? stats.team.name : '',
      team_logo: stats.team ? stats.team.logo : '',
      assists: (stats.goals && stats.goals.assists) || 0,
      goals: (stats.goals && stats.goals.total) || 0,
      games: (stats.games && stats.games.appearences) || 0,
      minutes: (stats.games && stats.games.minutes) || 0,
    };
  });

  console.log(`  TOP ${assists.length}: 1위 ${assists[0]?.player_name} (${assists[0]?.assists}도움)`);

  writeJsonSafe('assists.json', {
    season: SEASON,
    updated_at: new Date().toISOString(),
    players: assists,
  });

  return assists;
}

// 4. 손흥민 트래커
async function fetchSonHeungMin(scorers, assists) {
  console.log('\n[4/4] 손흥민 정보 가져오는 중...');

  // 먼저 득점/도움 순위에서 찾기 (이미 받은 데이터 재활용)
  let sonFromList =
    scorers.find((p) => p.nationality === 'South Korea') ||
    assists.find((p) => p.nationality === 'South Korea');

  // 없으면 직접 검색 (이름)
  let playerData = null;
  let playerStats = null;

  try {
    const search = await apiGet(`/players?league=${LEAGUE_ID}&season=${SEASON}&search=son`);
    const sonResults = (search.response || []).filter(
      (item) =>
        item.player.nationality === 'South Korea' ||
        (item.player.name && item.player.name.toLowerCase().includes('son')) ||
        (item.player.firstname && item.player.firstname.toLowerCase().includes('heung'))
    );

    if (sonResults.length > 0) {
      // 손흥민으로 추정되는 첫 번째 한국 국적 선수
      const son = sonResults.find((r) => r.player.nationality === 'South Korea') || sonResults[0];
      playerData = son.player;
      playerStats = (son.statistics && son.statistics[0]) || {};
    }
  } catch (e) {
    console.warn('  손흥민 검색 실패:', e.message);
  }

  // 데이터 결합
  let sonInfo;
  if (playerData) {
    sonInfo = {
      found: true,
      player_id: playerData.id,
      player_name: playerData.name,
      firstname: playerData.firstname,
      lastname: playerData.lastname,
      photo: playerData.photo,
      age: playerData.age,
      nationality: playerData.nationality,
      height: playerData.height,
      weight: playerData.weight,
      team_id: playerStats.team ? playerStats.team.id : null,
      team_name: playerStats.team ? playerStats.team.name : '',
      team_logo: playerStats.team ? playerStats.team.logo : '',
      games: (playerStats.games && playerStats.games.appearences) || 0,
      lineups: (playerStats.games && playerStats.games.lineups) || 0,
      minutes: (playerStats.games && playerStats.games.minutes) || 0,
      rating: playerStats.games ? playerStats.games.rating : null,
      position: playerStats.games ? playerStats.games.position : '',
      goals: (playerStats.goals && playerStats.goals.total) || 0,
      assists: (playerStats.goals && playerStats.goals.assists) || 0,
      shots_total: (playerStats.shots && playerStats.shots.total) || 0,
      shots_on: (playerStats.shots && playerStats.shots.on) || 0,
      passes_total: (playerStats.passes && playerStats.passes.total) || 0,
      passes_key: (playerStats.passes && playerStats.passes.key) || 0,
      yellow_cards: (playerStats.cards && playerStats.cards.yellow) || 0,
      red_cards: (playerStats.cards && playerStats.cards.red) || 0,
    };
    console.log(`  손흥민 발견: ${sonInfo.player_name} (${sonInfo.team_name}) - ${sonInfo.goals}골 ${sonInfo.assists}도움 ${sonInfo.games}경기`);
  } else if (sonFromList) {
    // 검색 실패 시 순위 데이터 활용
    sonInfo = {
      found: true,
      player_id: sonFromList.player_id,
      player_name: sonFromList.player_name,
      photo: sonFromList.player_photo,
      nationality: sonFromList.nationality,
      team_id: sonFromList.team_id,
      team_name: sonFromList.team_name,
      team_logo: sonFromList.team_logo,
      goals: sonFromList.goals,
      assists: sonFromList.assists,
      games: sonFromList.games,
      minutes: sonFromList.minutes,
    };
    console.log(`  손흥민(순위 데이터에서): ${sonInfo.player_name} - ${sonInfo.goals}골 ${sonInfo.assists}도움`);
  } else {
    sonInfo = {
      found: false,
      message: '손흥민 데이터를 찾을 수 없습니다. 시즌 시작 전이거나 출전 기록이 없을 수 있습니다.',
    };
    console.log('  손흥민 정보 없음');
  }

  writeJsonSafe('son.json', {
    season: SEASON,
    updated_at: new Date().toISOString(),
    son: sonInfo,
  });

  return sonInfo;
}

// 메타 정보
function writeMeta() {
  writeJsonSafe('meta.json', {
    season: SEASON,
    league_id: LEAGUE_ID,
    league_name: 'Major League Soccer',
    updated_at: new Date().toISOString(),
    source: 'API-Football (api-sports.io)',
    version: '1.0',
  });
}

// 메인 실행
(async () => {
  console.log('========================================');
  console.log('MLS 순위 앱 데이터 수집 시작');
  console.log(`시즌: ${SEASON}, 리그 ID: ${LEAGUE_ID}`);
  console.log(`시각: ${new Date().toISOString()}`);
  console.log('========================================');

  try {
    const { eastern, western } = await fetchStandings();
    const scorers = await fetchTopScorers();
    const assists = await fetchTopAssists();
    await fetchSonHeungMin(scorers, assists);
    writeMeta();

    console.log('\n========================================');
    console.log('✅ 모든 데이터 수집 완료');
    console.log('========================================');
    process.exit(0);
  } catch (error) {
    console.error('\n========================================');
    console.error('❌ 에러 발생:', error.message);
    console.error('========================================');
    process.exit(1);
  }
})();
