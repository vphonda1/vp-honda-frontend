import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LogOut } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function Navbar({ user, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const menuItems = [
    { label: 'V P Dashboard',       path: '/vph-dashboard',          roles: ['admin'],         icon: '📋' },
    { label: 'Dashboard',            path: '/dashboard',              roles: ['admin','staff']          },
    { label: 'Veh Dashboard',        path: '/veh-dashboard',          roles: ['admin'],         icon: '🏍️' },
    { label: 'Job Cards',            path: '/job-cards',              roles: ['admin','staff'], icon: '🎫' },
    { label: 'Parts',                path: '/parts',                  roles: ['admin','staff'], icon: '📦' },
    { label: 'Customers',            path: '/customers',              roles: ['admin','staff'], icon: '👥' },
    { label: 'Reminders',            path: '/reminders',              roles: ['admin','staff'], icon: '🔔' },
    { label: 'Reports',              path: '/reports',                roles: ['admin'],         icon: '📊' },
    { label: 'Management',           path: '/invoice-management',     roles: ['admin'],         icon: '📄' },
    { label: 'Data Management',      path: '/data-management',        roles: ['admin'],         icon: '📊' },
    { label: 'Quotation',            path: '/quotation',              roles: ['admin','staff'], icon: '📋' },
    { label: 'Admin',                path: '/admin',                  roles: ['admin'],         icon: '⚙️' },
    { label: 'Staff Management',     path: '/staff-management',       roles: ['admin','staff'], icon: '👥' },
  ];

  const visibleMenuItems = menuItems.filter(item => item.roles.includes(user?.role));
  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-full mx-auto px-4">
        <div className="flex justify-between items-center h-14">
          <Link to="/vph-dashboard" className="flex items-center gap-2 flex-shrink-0">
            <div className="bg-white text-red-600 rounded px-2.5 py-0.5 font-black text-lg">V P</div>
          </Link>
          <div className="hidden md:flex items-center gap-0.5 overflow-x-auto max-w-[calc(100%-240px)]">
            {visibleMenuItems.map(item => (
              <Link key={item.path} to={item.path}
                className={`px-2 py-1.5 rounded text-xs font-bold whitespace-nowrap transition ${
                  isActive(item.path) ? 'bg-white text-purple-600 shadow' : 'text-white hover:bg-white/20'
                }`}>
                {item.icon} {item.label}
              </Link>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <div className="bg-white/20 px-3 py-1 rounded text-xs">
              <span className="font-bold">{user?.name}</span>
              <span className="ml-1 opacity-75 uppercase text-[10px]">{user?.role}</span>
            </div>
            <Button onClick={onLogout} className="bg-red-600 hover:bg-red-700 text-white h-8 px-3 text-xs">
              <LogOut size={14} className="mr-1" /> Logout
            </Button>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded hover:bg-white/20">
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-white/20 space-y-1 mt-1">
            {visibleMenuItems.map(item => (
              <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-2 rounded text-sm font-bold transition ${
                  isActive(item.path) ? 'bg-white text-purple-600' : 'text-white hover:bg-white/20'
                }`}>
                {item.icon} {item.label}
              </Link>
            ))}
            <hr className="border-white/20 my-2" />
            <div className="px-4 py-2 bg-white/20 rounded">
              <span className="font-bold">{user?.name}</span>
              <span className="ml-2 text-xs uppercase opacity-75">{user?.role}</span>
            </div>
            <Button onClick={() => { onLogout(); setMobileMenuOpen(false); }} className="w-full bg-red-600 hover:bg-red-700 text-white mt-2">
              <LogOut size={16} className="mr-2" /> Logout
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}