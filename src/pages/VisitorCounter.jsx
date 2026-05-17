// ════════════════════════════════════════════════════════════════════════════
// VisitorCounter.jsx — VP Honda Showroom Visitor Tracking
// ════════════════════════════════════════════════════════════════════════════
// Features:
// • Quick visitor entry (1-tap counter)
// • Detailed visitor form (name, phone, purpose, model interest)
// • Today's stats + 7-day + 30-day trends
// • Conversion tracking (visitor → customer)
// • Purpose breakdown chart (Purchase/Service/Inquiry/General)
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, TrendingUp, Calendar, Phone, X, ChevronRight } from 'lucide-react';
import { recordVisitor, getVisitorStats, sendWhatsApp, buildCustomWA } from '../utils/smartUtils';

export default function VisitorCounter() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [visitors, setVisitors] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '', phone: '', purpose: 'Purchase', interestedModel: '', notes: '', handledBy: ''
  });
  const [filter, setFilter] = useState('today');

  useEffect(() => {
    refresh();
    // Auto-refresh every 30 seconds
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  const refresh = () => {
    setStats(getVisitorStats());
    const all = JSON.parse(localStorage.getItem('vp_visitors') || '[]');
    setVisitors(all);
  };

  // Quick anonymous visitor (one tap)
  const quickAdd = async (purpose) => {
    await recordVisitor({ name: 'Quick Entry', purpose });
    refresh();
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert('Visitor name जरूरी है');
      return;
    }
    await recordVisitor(formData);
    setFormData({ name: '', phone: '', purpose: 'Purchase', interestedModel: '', notes: '', handledBy: '' });
    setShowForm(false);
    refresh();
  };

  const handleConvert = (visitor) => {
    if (window.confirm(`${visitor.name} को customer के रूप में convert करना है?`)) {
      const all = JSON.parse(localStorage.getItem('vp_visitors') || '[]');
      const idx = all.findIndex(v => v.id === visitor.id);
      if (idx !== -1) {
        all[idx].converted = true;
        all[idx].convertedAt = new Date().toISOString();
        localStorage.setItem('vp_visitors', JSON.stringify(all));
      }
      // Pre-fill customer form
      navigate('/veh-dashboard');
      refresh();
    }
  };

  const handleFollowUp = (visitor) => {
    if (!visitor.phone) {
      alert('Phone नहीं है, follow-up नहीं भेज सकते');
      return;
    }
    const msg = buildCustomWA(
      `नमस्ते ${visitor.name} जी 🙏`,
      `आप कुछ दिन पहले VP Honda showroom आए थे। आपकी ${visitor.interestedModel || 'bike'} में रुचि के बारे में जानना चाहते थे।\n\nकोई भी प्रश्न हो तो बेझिझक call करें: 📞 9713394738\n\nहम आपकी सेवा में हाजिर हैं।`
    );
    sendWhatsApp(visitor.phone, msg);
  };

  // Filter visitors
  const filteredVisitors = visitors.filter(v => {
    if (filter === 'today') {
      return v.visitTime?.startsWith(new Date().toISOString().split('T')[0]);
    }
    if (filter === 'week') {
      const days = (Date.now() - new Date(v.visitTime).getTime()) / (1000 * 60 * 60 * 24);
      return days <= 7;
    }
    if (filter === 'month') {
      const days = (Date.now() - new Date(v.visitTime).getTime()) / (1000 * 60 * 60 * 24);
      return days <= 30;
    }
    return true;
  });

  return (
    <div style={{ padding: 16, background: '#020617', minHeight: '100vh', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={22}/> Showroom Visitors
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0 0' }}>
            आज showroom में कितने लोग आए — सब track करें
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ background: 'linear-gradient(135deg, #DC0000, #B91C1C)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <UserPlus size={14}/> + Add Visitor
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        <StatCard icon="👥" label="आज के Visitors" value={stats.today || 0} color="#DC0000" big />
        <StatCard icon="📅" label="पिछले 7 दिन" value={stats.last7Days || 0} color="#3b82f6" />
        <StatCard icon="📊" label="पिछले 30 दिन" value={stats.last30Days || 0} color="#a855f7" />
        <StatCard icon="🎯" label="Conversion Rate" value={`${stats.conversionRate || 0}%`} color="#16a34a" />
        <StatCard icon="🛒" label="Purchase Intent" value={stats.purchase || 0} color="#ea580c" />
        <StatCard icon="🔧" label="Service Visitors" value={stats.service || 0} color="#0891b2" />
      </div>

      {/* Quick Tap Buttons */}
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <p style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase' }}>
          ⚡ Quick Tap (1-click visitor entry)
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
          <QuickButton emoji="🛒" label="Purchase" color="#DC0000" onClick={() => quickAdd('Purchase')} />
          <QuickButton emoji="🔧" label="Service" color="#0891b2" onClick={() => quickAdd('Service')} />
          <QuickButton emoji="❓" label="Inquiry" color="#a855f7" onClick={() => quickAdd('Inquiry')} />
          <QuickButton emoji="👤" label="General" color="#64748b" onClick={() => quickAdd('General')} />
        </div>
        <p style={{ color: '#475569', fontSize: 10, marginTop: 8, fontStyle: 'italic' }}>
          💡 Visitor आते ही उनका मकसद tap करें — name बाद में add कर सकते हैं
        </p>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          { id: 'today', label: `आज (${stats.today || 0})` },
          { id: 'week',  label: `7 दिन (${stats.last7Days || 0})` },
          { id: 'month', label: `30 दिन (${stats.last30Days || 0})` },
          { id: 'all',   label: `सब (${stats.total || 0})` },
        ].map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            style={{
              background: filter === t.id ? '#DC0000' : '#1e293b',
              color: '#fff', border: 'none',
              padding: '6px 12px', borderRadius: 6,
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Visitor List */}
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
        {filteredVisitors.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            कोई visitor नहीं मिला इस अवधि में
          </div>
        ) : (
          filteredVisitors.map((v, i) => (
            <div key={v.id || i} style={{
              padding: '12px 14px',
              borderBottom: i < filteredVisitors.length - 1 ? '1px solid #1e293b' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16 }}>{purposeEmoji(v.purpose)}</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{v.name}</span>
                  {v.converted && (
                    <span style={{ background: '#16a34a', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700 }}>
                      ✓ Converted
                    </span>
                  )}
                  <span style={{ background: purposeColor(v.purpose), color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                    {v.purpose}
                  </span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>
                  {v.phone && <span>📞 {v.phone} · </span>}
                  {v.interestedModel && <span>🏍️ {v.interestedModel} · </span>}
                  <span>🕐 {new Date(v.visitTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                {v.notes && <p style={{ color: '#cbd5e1', fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>"{v.notes}"</p>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {!v.converted && (
                  <button onClick={() => handleConvert(v)}
                    style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    ✓ Convert
                  </button>
                )}
                {v.phone && (
                  <button onClick={() => handleFollowUp(v)}
                    style={{ background: '#25D366', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    📱 WA
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Visitor Form Modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 14, width: '100%', maxWidth: 480, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>👤 New Visitor</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18}/>
              </button>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <Field label="Visitor Name *" value={formData.name} onChange={v => setFormData({...formData, name: v})} />
              <Field label="Phone (optional)" value={formData.phone} onChange={v => setFormData({...formData, phone: v.replace(/\D/g,'')})} maxLength={10} />
              <div>
                <label style={lbl}>Purpose *</label>
                <select value={formData.purpose} onChange={(e) => setFormData({...formData, purpose: e.target.value})} style={inputStyle}>
                  <option value="Purchase">🛒 Purchase (खरीदने आए)</option>
                  <option value="Service">🔧 Service (मरम्मत)</option>
                  <option value="Inquiry">❓ Inquiry (पूछताछ)</option>
                  <option value="General">👤 General (सामान्य)</option>
                </select>
              </div>
              <Field label="Interested Model" value={formData.interestedModel} onChange={v => setFormData({...formData, interestedModel: v})} placeholder="जैसे: Activa STD" />
              <Field label="Notes" value={formData.notes} onChange={v => setFormData({...formData, notes: v})} placeholder="कोई extra बात" />
              <Field label="Handled By (कर्मचारी)" value={formData.handledBy} onChange={v => setFormData({...formData, handledBy: v})} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={handleSubmit}
                style={{ flex: 1, background: 'linear-gradient(135deg, #DC0000, #B91C1C)', color: '#fff', border: 'none', padding: '12px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}>
                💾 Save Visitor
              </button>
              <button onClick={() => setShowForm(false)}
                style={{ background: '#475569', color: '#fff', border: 'none', padding: '12px 18px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl = { color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 4, display: 'block' };
const inputStyle = { background: '#1e293b', color: '#fff', border: '1px solid #475569', borderRadius: 8, padding: '10px 12px', fontSize: 13, width: '100%', outline: 'none' };

function Field({ label, value, onChange, placeholder, maxLength }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || ''}
        maxLength={maxLength}
        style={inputStyle}
      />
    </div>
  );
}

function StatCard({ icon, label, value, color, big }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}22, ${color}08)`,
      border: `1px solid ${color}40`,
      borderRadius: 10,
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 18 }}>{icon}</div>
      <p style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, margin: '4px 0 2px', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ color: '#fff', fontSize: big ? 24 : 18, fontWeight: 900, margin: 0, lineHeight: 1.1 }}>{value}</p>
    </div>
  );
}

function QuickButton({ emoji, label, color, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        background: `${color}33`,
        border: `1px solid ${color}77`,
        color: '#fff',
        borderRadius: 10,
        padding: '14px 10px',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 700,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        transition: 'transform 0.15s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
    >
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

const purposeEmoji = (p) => ({
  Purchase: '🛒',
  Service: '🔧',
  Inquiry: '❓',
  General: '👤',
}[p] || '👤');

const purposeColor = (p) => ({
  Purchase: '#DC0000',
  Service: '#0891b2',
  Inquiry: '#a855f7',
  General: '#64748b',
}[p] || '#64748b');