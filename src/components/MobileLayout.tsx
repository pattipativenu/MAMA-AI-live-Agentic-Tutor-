import { ReactNode } from 'react';
import { Home, Clock, Settings, BookOpen } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function MobileLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide the bottom nav on full-screen mode pages (Lab/Exam active sessions)
  const isFullScreen =
    location.pathname.includes('/lab/entry') ||
    location.pathname.includes('/exam/entry');

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/study', label: 'Study', icon: BookOpen },
    { path: '/sessions', label: 'Sessions', icon: Clock },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="h-dvh bg-zinc-100 flex justify-center font-sans selection:bg-amber-500/30 overflow-hidden">
      {/* Mobile Container — fixed height so nav never scrolls away */}
      <div className="w-full max-w-[430px] bg-[rgb(250,249,245)] h-full flex flex-col shadow-2xl overflow-hidden">

        {/* Main Content Area — scrolls independently inside the container */}
        <main className="flex-1 overflow-y-auto scrollbar-hide">
          {children}
        </main>

        {/* Bottom Navigation Bar — always pinned, never scrolls */}
        {!isFullScreen && (
          <nav
            className="shrink-0 w-full bg-white/90 backdrop-blur-xl border-t border-zinc-200/50 flex justify-around items-center z-50"
            style={{ height: '3.75rem', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {navItems.map(({ path, label, icon: Icon }) => {
              const isActive = path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(path);
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${isActive ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-600'
                    }`}
                >
                  <Icon size={21} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[9px] font-semibold tracking-wide">{label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}
