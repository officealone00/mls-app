/**
 * MLS 30팀 정보 (2026 시즌)
 * 동부 15팀 + 서부 15팀
 * teamId는 ESPN의 team ID와 동일.
 */

export type Conference = 'eastern' | 'western';

export interface TeamInfo {
  name: string;        // 짧은 이름 (UI 표시용, 한글)
  fullName: string;    // 정식 명칭 (영문)
  shortName: string;   // 짧은 영문 (예: 'LAFC')
  teamId: string;      // ESPN team ID
  abbr: string;        // 약자 (예: 'LAFC')
  color: string;       // 메인 컬러
  bgLight: string;     // 배경용 옅은 컬러
  emoji: string;       // 백업용 이모지
  conference: Conference;
  city: string;
  hometown: string;    // 한글 연고지
}

// ─── 동부 컨퍼런스 (Eastern Conference) ─────────────
const EAST: Record<string, TeamInfo> = {
  '내슈빌':       { name: '내슈빌',       fullName: 'Nashville SC',           shortName: 'Nashville', teamId: '18986', abbr: 'NSH',  color: '#FFD700', bgLight: '#FFF8D6', emoji: '🎵', conference: 'eastern', city: 'Nashville',     hometown: '내슈빌' },
  '인터마이애미': { name: '인터마이애미', fullName: 'Inter Miami CF',         shortName: 'Miami',     teamId: '20232', abbr: 'MIA',  color: '#F7B5CD', bgLight: '#FDE8EF', emoji: '🌴', conference: 'eastern', city: 'Miami',         hometown: '마이애미' },
  '뉴잉글랜드':   { name: '뉴잉글랜드',   fullName: 'New England Revolution', shortName: 'New England', teamId: '189',  abbr: 'NE',   color: '#0A2240', bgLight: '#DDE3EE', emoji: '⚓', conference: 'eastern', city: 'Foxborough',    hometown: '뉴잉글랜드' },
  '시카고':       { name: '시카고',       fullName: 'Chicago Fire FC',        shortName: 'Chicago',   teamId: '182',   abbr: 'CHI',  color: '#E81F3E', bgLight: '#FBDADE', emoji: '🔥', conference: 'eastern', city: 'Chicago',       hometown: '시카고' },
  '샬럿':         { name: '샬럿',         fullName: 'Charlotte FC',           shortName: 'Charlotte', teamId: '21300', abbr: 'CLT',  color: '#1A85C8', bgLight: '#DCECF7', emoji: '👑', conference: 'eastern', city: 'Charlotte',     hometown: '샬럿' },
  '토론토':       { name: '토론토',       fullName: 'Toronto FC',             shortName: 'Toronto',   teamId: '7318',  abbr: 'TOR',  color: '#B6151A', bgLight: '#F5D9DA', emoji: '🍁', conference: 'eastern', city: 'Toronto',       hometown: '토론토' },
  '뉴욕시티':     { name: '뉴욕시티',     fullName: 'New York City FC',       shortName: 'NYCFC',     teamId: '17606', abbr: 'NYC',  color: '#6CADDF', bgLight: '#E0EEF8', emoji: '🗽', conference: 'eastern', city: 'New York',      hometown: '뉴욕' },
  '레드불뉴욕':   { name: '레드불뉴욕',   fullName: 'Red Bull New York',      shortName: 'RB NY',     teamId: '190',   abbr: 'RBNY', color: '#E32726', bgLight: '#FBDADC', emoji: '🐂', conference: 'eastern', city: 'Harrison',      hometown: '뉴저지' },
  '컬럼버스':     { name: '컬럼버스',     fullName: 'Columbus Crew',          shortName: 'Columbus',  teamId: '183',   abbr: 'CLB',  color: '#FFD200', bgLight: '#FFF6CC', emoji: '⚒️', conference: 'eastern', city: 'Columbus',      hometown: '컬럼버스' },
  'DC':           { name: 'DC',           fullName: 'D.C. United',            shortName: 'D.C.',      teamId: '193',   abbr: 'DC',   color: '#000000', bgLight: '#E0E0E0', emoji: '🏛️', conference: 'eastern', city: 'Washington',    hometown: '워싱턴' },
  '신시내티':     { name: '신시내티',     fullName: 'FC Cincinnati',          shortName: 'Cincinnati',teamId: '18267', abbr: 'CIN',  color: '#FE5000', bgLight: '#FFE0CD', emoji: '🦁', conference: 'eastern', city: 'Cincinnati',    hometown: '신시내티' },
  '올랜도':       { name: '올랜도',       fullName: 'Orlando City SC',        shortName: 'Orlando',   teamId: '12011', abbr: 'ORL',  color: '#633492', bgLight: '#E5DDED', emoji: '🦁', conference: 'eastern', city: 'Orlando',       hometown: '올랜도' },
  '몬트리올':     { name: '몬트리올',     fullName: 'CF Montréal',            shortName: 'Montréal',  teamId: '9720',  abbr: 'MTL',  color: '#0A4D8F', bgLight: '#D9E4ED', emoji: '🍁', conference: 'eastern', city: 'Montréal',      hometown: '몬트리올' },
  '필라델피아':   { name: '필라델피아',   fullName: 'Philadelphia Union',     shortName: 'Philadelphia',teamId:'10739', abbr: 'PHI',  color: '#072448', bgLight: '#D8DDE5', emoji: '🐍', conference: 'eastern', city: 'Chester',       hometown: '필라델피아' },
  '애틀랜타':     { name: '애틀랜타',     fullName: 'Atlanta United FC',      shortName: 'Atlanta',   teamId: '18418', abbr: 'ATL',  color: '#80000B', bgLight: '#EBD0D2', emoji: '🅰️', conference: 'eastern', city: 'Atlanta',       hometown: '애틀랜타' },
};

// ─── 서부 컨퍼런스 (Western Conference) ─────────────
const WEST: Record<string, TeamInfo> = {
  '산호세':       { name: '산호세',       fullName: 'San Jose Earthquakes',   shortName: 'San Jose',  teamId: '191',   abbr: 'SJ',   color: '#0067B1', bgLight: '#D6E5F2', emoji: '🌍', conference: 'western', city: 'San Jose',      hometown: '산호세' },
  '밴쿠버':       { name: '밴쿠버',       fullName: 'Vancouver Whitecaps',    shortName: 'Vancouver', teamId: '9727',  abbr: 'VAN',  color: '#00245D', bgLight: '#D5DBE5', emoji: '🌊', conference: 'western', city: 'Vancouver',     hometown: '밴쿠버' },
  'LAFC':         { name: 'LAFC',         fullName: 'Los Angeles FC',         shortName: 'LAFC',      teamId: '18966', abbr: 'LAFC', color: '#000000', bgLight: '#FFE9A8', emoji: '⚫', conference: 'western', city: 'Los Angeles',   hometown: 'LA' },
  '미네소타':     { name: '미네소타',     fullName: 'Minnesota United FC',    shortName: 'Minnesota', teamId: '17362', abbr: 'MIN',  color: '#585E61', bgLight: '#E0E1E2', emoji: '❄️', conference: 'western', city: 'Saint Paul',    hometown: '미네소타' },
  '시애틀':       { name: '시애틀',       fullName: 'Seattle Sounders FC',    shortName: 'Seattle',   teamId: '9726',  abbr: 'SEA',  color: '#5D9741', bgLight: '#DEEAD5', emoji: '🌲', conference: 'western', city: 'Seattle',       hometown: '시애틀' },
  '솔트레이크':   { name: '솔트레이크',   fullName: 'Real Salt Lake',         shortName: 'Salt Lake', teamId: '4771',  abbr: 'RSL',  color: '#A50531', bgLight: '#EFCED7', emoji: '🦅', conference: 'western', city: 'Sandy',         hometown: '유타' },
  '콜로라도':     { name: '콜로라도',     fullName: 'Colorado Rapids',        shortName: 'Colorado',  teamId: '184',   abbr: 'COL',  color: '#960A2C', bgLight: '#EBCED5', emoji: '🏔️', conference: 'western', city: 'Commerce City', hometown: '콜로라도' },
  '댈러스':       { name: '댈러스',       fullName: 'FC Dallas',              shortName: 'Dallas',    teamId: '185',   abbr: 'DAL',  color: '#BD1923', bgLight: '#F1D4D6', emoji: '🤠', conference: 'western', city: 'Frisco',        hometown: '댈러스' },
  '휴스턴':       { name: '휴스턴',       fullName: 'Houston Dynamo FC',      shortName: 'Houston',   teamId: '6077',  abbr: 'HOU',  color: '#F36F21', bgLight: '#FCE0CB', emoji: '🚀', conference: 'western', city: 'Houston',       hometown: '휴스턴' },
  '샌디에이고':   { name: '샌디에이고',   fullName: 'San Diego FC',           shortName: 'San Diego', teamId: '22529', abbr: 'SD',   color: '#0D1B36', bgLight: '#D8DCE3', emoji: '🌅', conference: 'western', city: 'San Diego',     hometown: '샌디에이고' },
  'LA갤럭시':     { name: 'LA갤럭시',     fullName: 'LA Galaxy',              shortName: 'LA Galaxy', teamId: '187',   abbr: 'LA',   color: '#00245D', bgLight: '#D5DBE5', emoji: '⭐', conference: 'western', city: 'Carson',        hometown: 'LA' },
  '포틀랜드':     { name: '포틀랜드',     fullName: 'Portland Timbers',       shortName: 'Portland',  teamId: '9723',  abbr: 'POR',  color: '#004812', bgLight: '#D2DDD3', emoji: '🪵', conference: 'western', city: 'Portland',      hometown: '포틀랜드' },
  '오스틴':       { name: '오스틴',       fullName: 'Austin FC',              shortName: 'Austin',    teamId: '20906', abbr: 'ATX',  color: '#00B140', bgLight: '#CDEAD6', emoji: '🌳', conference: 'western', city: 'Austin',        hometown: '오스틴' },
  '세인트루이스': { name: '세인트루이스', fullName: 'St. Louis CITY SC',      shortName: 'St. Louis', teamId: '21812', abbr: 'STL',  color: '#C8102E', bgLight: '#F5D5DA', emoji: '🌆', conference: 'western', city: 'St. Louis',     hometown: '세인트루이스' },
  '캔자스시티':   { name: '캔자스시티',   fullName: 'Sporting Kansas City',   shortName: 'Kansas City',teamId: '186',  abbr: 'SKC',  color: '#9CC1E9', bgLight: '#E4EFF8', emoji: '🌟', conference: 'western', city: 'Kansas City',   hometown: '캔자스시티' },
};

// ─── 통합 객체 ─────────────
export const TEAMS: Record<string, TeamInfo> = { ...EAST, ...WEST };
export const TEAM_NAMES = Object.keys(TEAMS);
export const EAST_TEAM_NAMES = Object.keys(EAST);
export const WEST_TEAM_NAMES = Object.keys(WEST);

/**
 * teamId로부터 팀 정보 찾기 (ESPN team ID 기반)
 */
export function getTeamByTeamId(teamId: string): TeamInfo | undefined {
  for (const [, t] of Object.entries(TEAMS)) {
    if (t.teamId === String(teamId)) return t;
  }
  return undefined;
}

/**
 * 팀 한글명을 받아서 정보 반환 (모르는 팀은 폴백)
 */
export function getTeam(name: string): TeamInfo {
  return (
    TEAMS[name] || {
      name,
      fullName: name,
      shortName: name,
      teamId: '',
      abbr: '',
      color: '#8B95A1',
      bgLight: '#F2F4F6',
      emoji: '⚽',
      conference: 'eastern',
      city: '',
      hometown: '',
    }
  );
}

/**
 * 영문 팀명/약자로부터 한글명 찾기
 * 스크래퍼가 영문으로 보낼 때 사용
 */
export function findTeamByEnglish(input: string): TeamInfo | undefined {
  if (!input) return undefined;
  const lower = input.toLowerCase().trim();
  for (const [, t] of Object.entries(TEAMS)) {
    if (
      t.fullName.toLowerCase() === lower ||
      t.shortName.toLowerCase() === lower ||
      t.abbr.toLowerCase() === lower
    ) {
      return t;
    }
  }
  // 부분 매칭 (예: "Los Angeles FC" 안에 "lafc"가 없어도 매칭)
  for (const [, t] of Object.entries(TEAMS)) {
    if (lower.includes(t.shortName.toLowerCase()) || lower.includes(t.abbr.toLowerCase())) {
      return t;
    }
  }
  return undefined;
}

export const LAFC_TEAM_NAME = 'LAFC';
