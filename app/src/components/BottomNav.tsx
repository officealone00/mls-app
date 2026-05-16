import { useNavigate, useLocation } from 'react-router-dom';
import { Trophy, MapPin, Star, Award } from 'lucide-react';

const navItems = [
  { path: '/',         label: '동부', icon: Trophy },
  { path: '/west',     label: '서부', icon: MapPin },
  { path: '/scorers',  label: '득점왕', icon: Award },
  { path: '/son',      label: '손흥민', icon: Star },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <Icon size={22} color={isActive ? '#3182F6' : '#B0B8C1'} strokeWidth={isActive ? 2.4 : 1.8} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
