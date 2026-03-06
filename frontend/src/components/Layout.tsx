import { Outlet, NavLink, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const tabs = [
  { to: '/', label: 'Dashboard', icon: '\u{1F4CA}' },
  { to: '/collection', label: 'Collection', icon: '\u{1F377}' },
  { to: '/tastings', label: 'Tastings', icon: '\u{1F4DD}' },
  { to: '/cocktails', label: 'Cocktails', icon: '\u{1F378}' },
  { to: '/shopping', label: 'Shopping', icon: '\u{1F6D2}' },
  { to: '/pantry', label: 'Pantry', icon: '\u{1F9C2}' },
];

export default function Layout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <nav className="hidden md:flex md:flex-col md:w-56 bg-stone-900 text-stone-100 p-4 gap-1">
        <h1 className="text-lg font-bold mb-6 px-3">Cellar & Bar</h1>
        {tabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `px-3 py-2 rounded text-sm ${isActive ? 'bg-stone-700' : 'hover:bg-stone-800'}`
            }
          >
            {t.icon} {t.label}
          </NavLink>
        ))}
        <div className="mt-auto pt-4 border-t border-stone-700">
          <Link to="/profile" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-stone-800 text-sm">
            {user?.image_path ? (
              <img src={user.image_path} className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-amber-600 flex items-center justify-center text-white text-xs font-bold">
                {(user?.display_name || user?.name || '?')[0].toUpperCase()}
              </div>
            )}
            <span className="truncate">{user?.display_name || user?.name}</span>
          </Link>
        </div>
      </nav>

      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between px-4 py-2 bg-white border-b">
        <span className="font-bold text-stone-900">Cellar & Bar</span>
        <Link to="/profile">
          {user?.image_path ? (
            <img src={user.image_path} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white text-xs font-bold">
              {(user?.display_name || user?.name || '?')[0].toUpperCase()}
            </div>
          )}
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-0 p-4 md:p-6 bg-stone-50 min-h-screen">
        <Outlet />
      </main>

      {/* Mobile bottom tabs */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 z-50">
        {tabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex flex-col items-center text-xs ${isActive ? 'text-amber-700' : 'text-stone-500'}`
            }
          >
            <span className="text-lg">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
