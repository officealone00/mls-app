import { useState } from 'react';
import { getTeam } from '@/data/teams';

interface Props {
  team: string;            // 한글 팀명
  size?: number;
  logoUrl?: string;        // 외부에서 직접 URL 지정 (스크래퍼 데이터)
}

/**
 * MLS 팀 로고
 * - 우선: ESPN 공식 로고 (URL 직접 또는 teamId 기반)
 * - 실패 시: 이모지 폴백
 */
export default function TeamLogo({ team, size = 28, logoUrl }: Props) {
  const info = getTeam(team);
  const [errored, setErrored] = useState(false);

  // ESPN 로고 URL 빌드 (logoUrl이 없으면 teamId로 자동 생성)
  const url =
    logoUrl ||
    (info.teamId
      ? `https://a.espncdn.com/i/teamlogos/soccer/500/${info.teamId}.png`
      : '');

  if (!url || errored) {
    return (
      <span
        style={{
          fontSize: size * 0.9,
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
        }}
      >
        {info.emoji}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={team}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'inline-block',
      }}
      onError={() => setErrored(true)}
      loading="lazy"
    />
  );
}
