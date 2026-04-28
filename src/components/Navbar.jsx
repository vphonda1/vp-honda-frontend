import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, Bell, MessageCircle, Video, Users, Truck, Calendar, DollarSign, FolderOpen, Brain, Eye } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function Navbar({ user, onLogout }) {
  const [open, setOpen]       = useState(false);
  const [group, setGroup]     = useState(null); // for dropdown groups
  const location              = useLocation();
  const isActive = (p)        => location.pathname === p;
  const isAdmin               = user?.role === 'admin';
  const isStaff               = user?.role === 'admin' || user?.role === 'staff';

  // ── Main nav items (always visible in top bar) ────────────────────────────
  const mainItems = [
    { label:'Dashboard',     path:'/dashboard',          show: isStaff, icon:'🏠' },
    { label:'VP Dashboard',  path:'/vph-dashboard',      show: isAdmin, icon:'📋' },
    { label:'Veh Sales',     path:'/veh-dashboard',      show: isAdmin, icon:'🏍️' },
    { label:'Customers',     path:'/customers',          show: isStaff, icon:'👥' },
    { label:'Reminders',     path:'/reminders',          show: isStaff, icon:'🔔' },
    { label:'Job Cards',     path:'/job-cards',          show: isStaff, icon:'🎫' },
    { label:'Parts',         path:'/parts',              show: isStaff, icon:'📦' },
    { label:'Reports',       path:'/reports',            show: isAdmin, icon:'📊' },
  ].filter(i => i.show);

  // ── Smart Features group ──────────────────────────────────────────────────
  const smartItems = [
    { label:'Manager View',    path:'/manager',              show: isAdmin, icon:'👔' },
    { label:'BI Analytics',    path:'/business-intelligence',show: isAdmin, icon:'🧠' },
    { label:'Visitors',        path:'/visitors',             show: isStaff, icon:'👁️' },
    { label:'Pickup-Drop',     path:'/pickup-drop',          show: isStaff, icon:'🛵' },
    { label:'Customer Hub',    path:'/customer-hub',         show: isStaff, icon:'❤️' },
    { label:'Calendar',        path:'/calendar',             show: isStaff, icon:'📅' },
    { label:'Payments',        path:'/payments',             show: isStaff, icon:'💰' },
    { label:'Documents',       path:'/documents',            show: isStaff, icon:'📂' },
  ].filter(i => i.show);

  // ── Manage group ──────────────────────────────────────────────────────────
  const manageItems = [
    { label:'Staff Mgmt',      path:'/staff-management',    show: isStaff, icon:'👥' },
    { label:'Salary & Rent',   path:'/salary-management',   show: isAdmin, icon:'💵' },
    { label:'Invoice Mgmt',    path:'/invoice-management',  show: isAdmin, icon:'📄' },
    { label:'Quotation',       path:'/quotation',           show: isStaff, icon:'📋' },
    { label:'Data Mgmt',       path:'/data-management',     show: isAdmin, icon:'📊' },
    { label:'Admin',           path:'/admin',               show: isAdmin, icon:'⚙️' },
    { label:'Diagnostic',      path:'/diagnostic',          show: isAdmin, icon:'🔍' },
  ].filter(i => i.show);

  const NavLink = ({ item, onClick }) => (
    <Link
      to={item.path}
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-bold whitespace-nowrap transition-all ${
        isActive(item.path)
          ? 'bg-white text-red-600 shadow-sm'
          : 'text-white hover:bg-white/20'
      }`}
    >
      <span>{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );

  const Dropdown = ({ label, icon, items, id }) => {
    const anyActive = items.some(i => isActive(i.path));
    return (
      <div className="relative" style={{ overflow: 'visible' }} onMouseLeave={() => setGroup(null)}>
        <button
          onMouseEnter={() => setGroup(id)}
          onClick={() => setGroup(g => g === id ? null : id)}
          className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-bold whitespace-nowrap transition-all ${
            anyActive || group === id ? 'bg-white text-red-600 shadow-sm' : 'text-white hover:bg-white/20'
          }`}
        >
          <span>{icon}</span>
          <span>{label}</span>
          <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
        </button>
        {group === id && (
          <div
            style={{
              position: 'fixed',
              top: 48,
              zIndex: 9999,
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 10,
              minWidth: 200,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              padding: '4px 0',
            }}
          >
            {items.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setGroup(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 16px',
                  color: isActive(item.path) ? '#fff' : '#cbd5e1',
                  background: isActive(item.path) ? '#DC0000' : 'transparent',
                  fontWeight: 700,
                  fontSize: 12,
                  textDecoration: 'none',
                  transition: 'background 0.15s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { if (!isActive(item.path)) e.currentTarget.style.background = '#1e293b'; }}
                onMouseLeave={e => { if (!isActive(item.path)) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className="sticky top-0 z-50 shadow-lg" style={{ background: 'linear-gradient(135deg, #1e1b4b, #DC0000)' }}>
      <div className="max-w-full mx-auto px-3">
        <div className="flex justify-between items-center h-12">

          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 flex-shrink-0">
            <div className="bg-white text-red-600 rounded px-2 py-0.5 font-black text-base leading-tight">
              VP
            </div>
            <span className="text-white font-black text-sm hidden sm:block">Honda</span>
          </Link>

          {/* Desktop nav - overflow visible for dropdowns */}
          <div className="hidden lg:flex items-center gap-0.5 flex-1 mx-3" style={{ overflow: 'visible' }}>
            {/* Main items */}
            {mainItems.map(item => <NavLink key={item.path} item={item} />)}

            {/* Smart features dropdown */}
            {smartItems.length > 0 && (
              <Dropdown label="Smart" icon="⚡" items={smartItems} id="smart" />
            )}

            {/* Manage dropdown */}
            {manageItems.length > 0 && (
              <Dropdown label="Manage" icon="⚙️" items={manageItems} id="manage" />
            )}
          </div>

          {/* Right side: Chat, Meeting, User, Logout */}
          <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
            {/* Chat Button */}
            <Link to="/chat" title="Team Chat"
              className={`p-2 rounded-lg transition-all ${isActive('/chat') ? 'bg-white text-purple-600' : 'text-white hover:bg-white/20'}`}>
              <MessageCircle size={16} />
            </Link>

            {/* Meeting Button */}
            <Link to="/meeting" title="Video Meeting"
              className={`p-2 rounded-lg transition-all ${isActive('/meeting') ? 'bg-white text-purple-600' : 'text-white hover:bg-white/20'}`}>
              <Video size={16} />
            </Link>

            {/* User badge */}
            <div className="bg-white/15 px-2.5 py-1 rounded-lg text-xs border border-white/20">
              <span className="font-bold text-white">{user?.name?.split(' ')[0] || 'User'}</span>
              <span className="ml-1 text-white/60 uppercase text-[9px]">{user?.role}</span>
            </div>

            {/* Logout */}
            <Button onClick={onLogout} className="bg-red-700 hover:bg-red-800 text-white h-7 px-2.5 text-xs">
              <LogOut size={12} className="mr-1" /> Logout
            </Button>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setOpen(!open)} className="lg:hidden p-2 rounded hover:bg-white/20 text-white">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="lg:hidden pb-4 border-t border-white/20 mt-1 max-h-[80vh] overflow-y-auto">

            {/* Quick actions */}
            <div className="flex gap-2 p-3 border-b border-white/10">
              <Link to="/chat" onClick={() => setOpen(false)}
                className="flex-1 flex items-center justify-center gap-2 bg-purple-700 hover:bg-purple-600 text-white py-2 rounded-lg text-xs font-bold">
                <MessageCircle size={14}/> Chat
              </Link>
              <Link to="/meeting" onClick={() => setOpen(false)}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-700 hover:bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold">
                <Video size={14}/> Meeting
              </Link>
              <Link to="/reminders" onClick={() => setOpen(false)}
                className="flex-1 flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 text-white py-2 rounded-lg text-xs font-bold">
                <Bell size={14}/> Alerts
              </Link>
            </div>

            {/* All items grouped */}
            <div className="p-3 space-y-1">
              <p className="text-white/40 text-[10px] font-bold uppercase px-2 py-1">Main</p>
              {mainItems.map(item => (
                <Link key={item.path} to={item.path} onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition ${
                    isActive(item.path) ? 'bg-white text-red-600' : 'text-white hover:bg-white/15'
                  }`}>
                  <span>{item.icon}</span><span>{item.label}</span>
                </Link>
              ))}

              {smartItems.length > 0 && <>
                <p className="text-white/40 text-[10px] font-bold uppercase px-2 py-1 mt-3">⚡ Smart Features</p>
                {smartItems.map(item => (
                  <Link key={item.path} to={item.path} onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition ${
                      isActive(item.path) ? 'bg-white text-red-600' : 'text-white hover:bg-white/15'
                    }`}>
                    <span>{item.icon}</span><span>{item.label}</span>
                  </Link>
                ))}
              </>}

              {manageItems.length > 0 && <>
                <p className="text-white/40 text-[10px] font-bold uppercase px-2 py-1 mt-3">⚙️ Manage</p>
                {manageItems.map(item => (
                  <Link key={item.path} to={item.path} onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition ${
                      isActive(item.path) ? 'bg-white text-red-600' : 'text-white hover:bg-white/15'
                    }`}>
                    <span>{item.icon}</span><span>{item.label}</span>
                  </Link>
                ))}
              </>}
            </div>

            {/* User + Logout */}
            <div className="px-3 mt-2 border-t border-white/20 pt-3">
              <div className="bg-white/15 px-3 py-2 rounded-lg mb-2">
                <span className="font-bold text-white text-sm">{user?.name}</span>
                <span className="ml-2 text-white/60 text-xs uppercase">{user?.role}</span>
              </div>
              <Button onClick={() => { onLogout(); setOpen(false); }} className="w-full bg-red-700 hover:bg-red-800 text-white">
                <LogOut size={15} className="mr-2" /> Logout
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
