import { useState, useEffect } from 'react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import StandingsPage from '@/pages/StandingsPage';
import SonPage from '@/pages/SonPage';
import ScorersPage from '@/pages/ScorersPage';
import TeamReportPage from '@/pages/TeamReportPage';
import BottomNav from '@/components/BottomNav';
import FavoriteTeamModal from '@/components/FavoriteTeamModal';
import {
  hasOnboarded,
  markOnboarded,
  setFavoriteTeam,
} from '@/utils/storage';

export default function App() {
  // MemoryRouter: 앱인토스 웹뷰의 뒤로가기 버튼과 브라우저 히스토리 충돌 방지
  return (
    <MemoryRouter initialEntries={['/']}>
      <AppShell />
    </MemoryRouter>
  );
}

function AppShell() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  // 첫 진입 시 온보딩 모달
  useEffect(() => {
    if (!hasOnboarded()) {
      const t = setTimeout(() => setShowOnboarding(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const handleOnboardingSelect = (team: string | null) => {
    setFavoriteTeam(team);
    markOnboarded();
  };

  return (
    <>
      <BackButtonHandler />
      <div className="page-content">
        <Routes>
          <Route path="/" element={<StandingsPage conference="eastern" />} />
          <Route path="/west" element={<StandingsPage conference="western" />} />
          <Route path="/scorers" element={<ScorersPage />} />
          <Route path="/son" element={<SonPage />} />
          <Route path="/team-report" element={<TeamReportPage />} />
        </Routes>
      </div>
      <BottomNav />

      {/* 첫 진입 온보딩 */}
      {showOnboarding && (
        <FavoriteTeamModal
          currentTeam={null}
          isOnboarding
          onClose={() => setShowOnboarding(false)}
          onSelect={handleOnboardingSelect}
        />
      )}
    </>
  );
}

// ─── 앱인토스 뒤로가기 통합 처리 ───
function BackButtonHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleBack = (e: PopStateEvent) => {
      if (location.pathname !== '/') {
        e.preventDefault();
        navigate('/', { replace: true });
        window.history.pushState(null, '', window.location.href);
      }
    };

    window.addEventListener('popstate', handleBack);
    window.history.pushState(null, '', window.location.href);

    return () => window.removeEventListener('popstate', handleBack);
  }, [location.pathname, navigate]);

  return null;
}
