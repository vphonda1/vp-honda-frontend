// ════════════════════════════════════════════════════════════════════════════
// ManagerView.jsx — VP Honda Manager Mobile Dashboard
// ════════════════════════════════════════════════════════════════════════════
// Mobile-first compact view designed for owner/manager phone usage:
// • Today's snapshot (sales, attendance, dues)
// • Quick approve/reject (advance, leave)
// • Critical alerts
// • One-screen view of everything important
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, X, ChevronRight, RefreshCw, AlertTriangle, TrendingUp, Users, Phone } from 'lucide-react';
import { api } from '../utils/apiConfig';
import { sendWhatsApp, buildCustomWA, getServiceSchedule, showInAppToast } from '../utils/smartUtils';

export default function ManagerView({ user }) {
  const navigate = useNavigate();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const load = async () => {
    setRefreshing(true);
    try {
      const [customers, invoices, services, staff, salaries, attendance, parts] = await Promise.all([
        fetch(api('/api/customers')).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(api('/api/invoices')).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(api('/api/service-data')).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(api('/api/staff')).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(api('/api/salaries')).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(api('/api/attendance')).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(api('/api/parts')).then(r => r.ok ? r.json() : []).catch(() => []),
      ]);

      const today = new Date().toISOString().split('T')[0];

      // Today's metrics
      const todayInvoices = invoices.filter(i => (i.invoiceDate || i.date)?.startsWith(today));
      const todayServices = services.filter(s => s.date?.startsWith(today));
      const todayRevenue = todayInvoices.reduce((s, i) => s + Number(i.price || 0), 0);

      // Attendance today
      const todayAttendance = attendance.filter(a => a.date?.startsWith(today));
      const presentStaff = todayAttendance.length;
      const absentStaff = staff.length - presentStaff;

      // Service reminders (overdue)
      const overdueReminders = customers.flatMap(c => {
        const purchaseDate = c.linkedVehicle?.purchaseDate || c.purchaseDate;
        if (!purchaseDate) return [];
        return getServiceSchedule(purchaseDate).filter(s => s.status === 'overdue').map(s => ({ customer: c, service: s }));
      });

      // Stock alerts
      const lowStock = parts.filter(p => {
        const stock = Number(p.stock || p.quantity || 0);
        const min = Number(p.minStock || 0);
        return min > 0 && stock <= min;
      });

      // Pending advances (assumption: type='advance' with no deduction)
      const totalAdvances = salaries.filter(s => s.type === 'advance' && !s.cancelled).reduce((sum, s) => sum + Number(s.amount || 0), 0);
      const totalDeductions = salaries.filter(s => s.type === 'deduction' && !s.cancelled).reduce((sum, s) => sum + Number(s.amount || 0), 0);
      const pendingAdvances = totalAdvances - totalDeductions;

      // Today's visitors
      const visitors = JSON.parse(localStorage.getItem('vp_visitors') || '[]');
      const todayVisitors = visitors.filter(v => v.visitTime?.startsWith(today));

      // Today's pickup/drops
      const pickups = JSON.parse(localStorage.getItem('vp_pickup_drops') || '[]');
      const todayPickups = pickups.filter(p => p.pickupTime?.startsWith(today));
      const activePickups = pickups.filter(p => p.status === 'scheduled' || p.status === 'in-transit');

      setData({
        todayInvoices, todayServices, todayRevenue, todayVisitors, todayPickups,
        presentStaff, absentStaff, overdueReminders, lowStock,
        pendingAdvances, activePickups,
        customers, staff, invoices, services, salaries,
      });
    } catch (e) {
      console.log('Load failed:', e);
    }
    setRefreshing(false);
    setLoading(false);
  };

  if (loading) return <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>⏳ Loading manager view...</div>;

  return (
    <div style={{ padding: 12, background: '#020617', minHeight: '100vh', color: '#fff', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>👔 Manager View</h1>
          <p style={{ color: '#94a3b8', fontSize: 11, margin: '2px 0 0' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} ·
            {' '}{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button onClick={load}
          style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''}/>
        </button>
      </div>

      {/* Today's Snapshot */}
      <div style={{ background: 'linear-gradient(135deg, #DC000022, #DC000008)', border: '1px solid #DC000055', borderRadius: 14, padding: 14, marginBottom: 12 }}>
        <p style={{ color: '#fbbf24', fontSize: 11, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>📊 आज का Snapshot</p>
        <p style={{ color: '#fff', fontSize: 32, fontWeight: 900, margin: '6px 0' }}>
          ₹{(data.todayRevenue / 1000).toFixed(1)}k
        </p>
        <p style={{ color: '#cbd5e1', fontSize: 12, margin: 0 }}>
          {data.todayInvoices.length} sales · {data.todayServices.length} services · {data.todayVisitors.length} visitors
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
        <QuickStat icon="👥" label="Present" value={data.presentStaff} subValue={`${data.absentStaff} absent`} color="#16a34a"/>
        <QuickStat icon="🚲" label="Today Visitors" value={data.todayVisitors.length} color="#3b82f6" onClick={() => navigate('/visitors')}/>
        <QuickStat icon="🛵" label="Active Pickups" value={data.activePickups.length} color="#a855f7" onClick={() => navigate('/pickup-drop')}/>
        <QuickStat icon="💰" label="Pending Advances" value={`₹${((data.pendingAdvances || 0) / 1000).toFixed(1)}k`} color="#fbbf24" onClick={() => navigate('/salary-management')}/>
      </div>

      {/* Critical Alerts */}
      <div style={{ marginBottom: 12 }}>
        <p style={{ color: '#fca5a5', fontSize: 11, fontWeight: 700, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={12}/> Critical Alerts
        </p>
        {data.overdueReminders.length === 0 && data.lowStock.length === 0 && (
          <div style={{ background: 'linear-gradient(135deg, #16a34a22, #16a34a08)', border: '1px solid #16a34a55', borderRadius: 10, padding: 12 }}>
            <p style={{ color: '#86efac', fontSize: 13, fontWeight: 700, margin: 0 }}>✅ कोई critical alert नहीं</p>
            <p style={{ color: '#94a3b8', fontSize: 11, margin: '3px 0 0' }}>सब कुछ control में है!</p>
          </div>
        )}

        {data.overdueReminders.length > 0 && (
          <AlertCard
            icon="🚨" label={`${data.overdueReminders.length} Service Reminders Overdue`}
            description={`Customer service reminders pending — ${data.overdueReminders.slice(0, 2).map(r => r.customer.name).join(', ')}${data.overdueReminders.length > 2 ? '...' : ''}`}
            color="#dc2626" onClick={() => navigate('/customer-hub')}
          />
        )}
        {data.lowStock.length > 0 && (
          <AlertCard
            icon="📦" label={`${data.lowStock.length} Parts Low Stock`}
            description={`Reorder needed: ${data.lowStock.slice(0, 2).map(p => p.partName).join(', ')}${data.lowStock.length > 2 ? '...' : ''}`}
            color="#ea580c" onClick={() => navigate('/parts')}
          />
        )}
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 12 }}>
        <p style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⚡ Quick Actions</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <ActionTile icon="🏍️" label="Add Customer" onClick={() => navigate('/veh-dashboard')}/>
          <ActionTile icon="🛵" label="Schedule Pickup" onClick={() => navigate('/pickup-drop')}/>
          <ActionTile icon="📊" label="Business Intelligence" onClick={() => navigate('/business-intelligence')}/>
          <ActionTile icon="💰" label="Salary & Rent" onClick={() => navigate('/salary-management')}/>
          <ActionTile icon="❤️" label="Customer Hub" onClick={() => navigate('/customer-hub')}/>
          <ActionTile icon="👔" label="Staff Mgmt" onClick={() => navigate('/staff-management')}/>
        </div>
      </div>

      {/* Today's Sales */}
      {data.todayInvoices.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🏍️ आज की Sales</p>
          <div style={{ display: 'grid', gap: 6 }}>
            {data.todayInvoices.slice(0, 5).map((inv, i) => (
              <div key={i} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>{inv.customerName}</p>
                  <p style={{ color: '#86efac', fontSize: 12, fontWeight: 800, margin: 0 }}>₹{(inv.price || 0).toLocaleString('en-IN')}</p>
                </div>
                <p style={{ color: '#94a3b8', fontSize: 10, margin: '2px 0 0' }}>{inv.vehicleModel}</p>
              </div>
            ))}
          </div>
          {data.todayInvoices.length > 5 && (
            <button onClick={() => navigate('/invoice-management')}
              style={{ background: 'transparent', color: '#94a3b8', border: 'none', padding: '6px', fontSize: 11, marginTop: 6, width: '100%', textAlign: 'center', cursor: 'pointer' }}>
              + {data.todayInvoices.length - 5} more →
            </button>
          )}
        </div>
      )}

      {/* Today's Visitors */}
      {data.todayVisitors.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🏪 आज के Visitors</p>
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 10 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Purchase', count: data.todayVisitors.filter(v => v.purpose === 'Purchase').length, color: '#DC0000' },
                { label: 'Service',  count: data.todayVisitors.filter(v => v.purpose === 'Service').length,  color: '#0891b2' },
                { label: 'Inquiry',  count: data.todayVisitors.filter(v => v.purpose === 'Inquiry').length,  color: '#a855f7' },
                { label: 'General',  count: data.todayVisitors.filter(v => v.purpose === 'General').length,  color: '#64748b' },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, minWidth: 60, textAlign: 'center' }}>
                  <p style={{ color: s.color, fontSize: 18, fontWeight: 900, margin: 0 }}>{s.count}</p>
                  <p style={{ color: '#94a3b8', fontSize: 9, margin: '2px 0 0', textTransform: 'uppercase', fontWeight: 700 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <p style={{ color: '#475569', fontSize: 10, textAlign: 'center', margin: '14px 0' }}>
        🔄 Auto-refresh every 60s · Last updated {new Date().toLocaleTimeString('en-IN')}
      </p>
    </div>
  );
}

// ────────── COMPONENTS ──────────

function QuickStat({ icon, label, value, subValue, color, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: `linear-gradient(135deg, ${color}22, ${color}08)`,
      border: `1px solid ${color}44`,
      borderRadius: 10, padding: '10px 12px',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ fontSize: 18 }}>{icon}</div>
      <p style={{ color: '#94a3b8', fontSize: 9, fontWeight: 700, margin: '4px 0 2px', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ color: '#fff', fontSize: 18, fontWeight: 900, margin: 0, lineHeight: 1.1 }}>{value}</p>
      {subValue && <p style={{ color: '#64748b', fontSize: 9, margin: '2px 0 0' }}>{subValue}</p>}
    </div>
  );
}

function AlertCard({ icon, label, description, color, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: `linear-gradient(135deg, ${color}22, ${color}08)`,
      border: `1px solid ${color}66`,
      borderRadius: 10, padding: '10px 12px',
      marginBottom: 6, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{label}</p>
        <p style={{ color: '#cbd5e1', fontSize: 11, margin: '3px 0 0' }}>{description}</p>
      </div>
      <ChevronRight size={16} color="#64748b"/>
    </div>
  );
}

function ActionTile({ icon, label, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        background: '#0f172a',
        border: '1px solid #1e293b',
        color: '#fff',
        borderRadius: 10,
        padding: '12px 10px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        fontWeight: 700,
        textAlign: 'left',
      }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      <ChevronRight size={12} color="#64748b"/>
    </button>
  );
}