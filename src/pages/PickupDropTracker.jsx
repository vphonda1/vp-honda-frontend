// ════════════════════════════════════════════════════════════════════════════
// PickupDropTracker.jsx — VP Honda Service Pickup/Drop Tracking
// ════════════════════════════════════════════════════════════════════════════
// Features:
// • Schedule pickup (customer name + address + GPS)
// • Mark in-transit when driver picks up bike
// • Mark completed with proof photo
// • Photos: bike condition, customer signature
// • WhatsApp customer with status updates
// • Live status dashboard
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { Truck, MapPin, Phone, Camera, Check, X, Clock, Navigation, Send } from 'lucide-react';
import {
  recordPickupDrop, getPickupDropStats, updatePickupDrop,
  captureFromCamera, getCurrentLocation, sendWhatsApp, buildCustomWA
} from '../utils/smartUtils';

export default function PickupDropTracker() {
  const [stats, setStats] = useState({});
  const [list, setList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('active');
  const [formData, setFormData] = useState({
    customerName: '', customerPhone: '', vehicleRegNo: '', vehicleModel: '',
    type: 'pickup', pickupAddress: '', notes: '', handledBy: ''
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  const refresh = () => {
    setStats(getPickupDropStats());
    setList(JSON.parse(localStorage.getItem('vp_pickup_drops') || '[]'));
  };

  const handleScheduleNew = async () => {
    if (!formData.customerName.trim() || !formData.pickupAddress.trim()) {
      alert('Customer name और pickup address जरूरी हैं');
      return;
    }
    setBusy(true);

    // Try to get GPS coordinates of pickup
    let lat = null, lng = null;
    try {
      const loc = await getCurrentLocation();
      lat = loc.lat;
      lng = loc.lng;
    } catch {
      // GPS not allowed — continue without
    }

    await recordPickupDrop({
      ...formData,
      pickupLat: lat,
      pickupLng: lng,
      status: 'scheduled',
    });

    // Auto-send WhatsApp confirmation to customer
    if (formData.customerPhone) {
      const msg = buildCustomWA(
        `नमस्ते ${formData.customerName} जी 🙏`,
        `आपकी ${formData.vehicleModel || 'bike'} (${formData.vehicleRegNo || 'Reg No'}) के लिए ${formData.type === 'pickup' ? 'pickup' : 'drop'} schedule हो गई है।\n\n📍 Address: ${formData.pickupAddress}\n\nहमारा driver जल्दी पहुंचेगा। कोई भी प्रश्न हो तो call करें: 📞 9713394738`
      );
      // Open WA in new tab (customer informed)
      const ans = window.confirm(`✅ Schedule हो गई!\n\nCustomer को WhatsApp भेजना है confirmation का?`);
      if (ans) sendWhatsApp(formData.customerPhone, msg);
    }

    setFormData({ customerName: '', customerPhone: '', vehicleRegNo: '', vehicleModel: '', type: 'pickup', pickupAddress: '', notes: '', handledBy: '' });
    setShowForm(false);
    setBusy(false);
    refresh();
  };

  const handleStartTransit = async (entry) => {
    let lat = null, lng = null;
    try {
      const loc = await getCurrentLocation();
      lat = loc.lat;
      lng = loc.lng;
    } catch {}

    updatePickupDrop(entry.id, {
      status: 'in-transit',
      transitStartTime: new Date().toISOString(),
      transitStartLat: lat,
      transitStartLng: lng,
    });

    // WhatsApp notify customer
    if (entry.customerPhone) {
      const msg = buildCustomWA(
        `नमस्ते ${entry.customerName} जी 🙏`,
        `🛵 आपकी bike pickup के लिए हमारा driver रवाना हो गया है!\n\nजल्दी पहुंचेगा। तैयार रहिए।\n\nकोई problem हो तो call: 📞 9713394738`
      );
      const ans = window.confirm('In-transit notification भेजना है customer को?');
      if (ans) sendWhatsApp(entry.customerPhone, msg);
    }

    refresh();
  };

  const handleCapturePhoto = async (entry) => {
    try {
      const photo = await captureFromCamera('environment');
      const photos = entry.photos || [];
      photos.push({ data: photo, time: new Date().toISOString() });
      updatePickupDrop(entry.id, { photos });
      refresh();
      alert('✅ Photo saved');
    } catch (err) {
      alert('Photo capture failed: ' + err);
    }
  };

  const handleComplete = async (entry) => {
    let lat = null, lng = null;
    try {
      const loc = await getCurrentLocation();
      lat = loc.lat;
      lng = loc.lng;
    } catch {}

    updatePickupDrop(entry.id, {
      status: 'completed',
      completedTime: new Date().toISOString(),
      dropLat: lat,
      dropLng: lng,
    });

    // WhatsApp notify customer
    if (entry.customerPhone) {
      const msg = buildCustomWA(
        `नमस्ते ${entry.customerName} जी 🙏`,
        `✅ आपकी ${entry.vehicleModel || 'bike'} ${entry.type === 'pickup' ? 'showroom पहुंच गई है' : 'आपके पास deliver हो गई है'}!\n\nधन्यवाद!\n\nVP Honda Team\n📞 9713394738`
      );
      const ans = window.confirm('Completion notification भेजना है?');
      if (ans) sendWhatsApp(entry.customerPhone, msg);
    }

    refresh();
  };

  const handleCancel = (entry) => {
    if (!window.confirm('यह pickup-drop cancel करनी है?')) return;
    updatePickupDrop(entry.id, { status: 'cancelled' });
    refresh();
  };

  // Filter
  const filtered = list.filter(p => {
    if (filter === 'active') return p.status === 'scheduled' || p.status === 'in-transit';
    if (filter === 'completed') return p.status === 'completed';
    if (filter === 'cancelled') return p.status === 'cancelled';
    return true;
  });

  return (
    <div style={{ padding: 16, background: '#020617', minHeight: '100vh', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Truck size={22}/> Pickup & Drop Tracking
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0 0' }}>
            Customer के घर से bike pickup और delivery — सब track करें
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ background: 'linear-gradient(135deg, #DC0000, #B91C1C)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          ➕ Schedule Pickup/Drop
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
        <StatCard icon="🛵" label="आज" value={stats.today || 0} color="#DC0000" />
        <StatCard icon="⏰" label="Pending" value={stats.pending || 0} color="#ea580c" />
        <StatCard icon="🚚" label="In Transit" value={stats.inTransit || 0} color="#3b82f6" />
        <StatCard icon="✅" label="Completed" value={stats.completed || 0} color="#16a34a" />
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { id: 'active',    label: `🔄 Active (${(stats.pending || 0) + (stats.inTransit || 0)})` },
          { id: 'completed', label: `✅ Completed (${stats.completed || 0})` },
          { id: 'cancelled', label: `❌ Cancelled` },
          { id: 'all',       label: `📋 All (${stats.total || 0})` },
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

      {/* List */}
      <div style={{ display: 'grid', gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 30, textAlign: 'center', color: '#64748b' }}>
            कोई pickup/drop नहीं है इस filter में
          </div>
        ) : (
          filtered.map(p => (
            <div key={p.id} style={{
              background: '#0f172a',
              border: `1px solid ${statusBorder(p.status)}`,
              borderRadius: 12,
              padding: 14,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 18 }}>{p.type === 'pickup' ? '🛵' : '🏠'}</span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{p.customerName}</span>
                    <StatusBadge status={p.status} />
                    <span style={{ background: '#1e293b', color: '#cbd5e1', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                      {p.type === 'pickup' ? 'PICKUP' : 'DROP'}
                    </span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                    🏍️ {p.vehicleModel || '-'} {p.vehicleRegNo && `· ${p.vehicleRegNo}`}
                    {p.customerPhone && <> · 📞 {p.customerPhone}</>}
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                    <MapPin size={12} style={{ flexShrink: 0, marginTop: 2 }}/>
                    <span>{p.pickupAddress}</span>
                  </div>
                  <div style={{ color: '#475569', fontSize: 10, marginTop: 4 }}>
                    🕐 {new Date(p.pickupTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    {p.handledBy && <> · 👤 {p.handledBy}</>}
                  </div>
                </div>
              </div>

              {/* Photos */}
              {p.photos && p.photos.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  {p.photos.map((ph, i) => (
                    <img key={i} src={ph.data || ph}
                      onClick={() => window.open(ph.data || ph, '_blank')}
                      style={{ width: 60, height: 60, borderRadius: 6, objectFit: 'cover', border: '1px solid #334155', cursor: 'pointer' }}/>
                  ))}
                </div>
              )}

              {/* Notes */}
              {p.notes && (
                <p style={{ color: '#cbd5e1', fontSize: 11, marginBottom: 10, fontStyle: 'italic', borderLeft: '2px solid #475569', paddingLeft: 8 }}>
                  📝 {p.notes}
                </p>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {p.status === 'scheduled' && (
                  <>
                    <ActionBtn icon={<Truck size={12}/>} label="Start Transit" color="#3b82f6" onClick={() => handleStartTransit(p)}/>
                    <ActionBtn icon={<X size={12}/>} label="Cancel" color="#7f1d1d" onClick={() => handleCancel(p)}/>
                  </>
                )}
                {p.status === 'in-transit' && (
                  <>
                    <ActionBtn icon={<Camera size={12}/>} label="Photo" color="#8b5cf6" onClick={() => handleCapturePhoto(p)}/>
                    <ActionBtn icon={<Check size={12}/>} label="Complete" color="#16a34a" onClick={() => handleComplete(p)}/>
                  </>
                )}
                {p.customerPhone && (
                  <ActionBtn icon={<Phone size={12}/>} label="Call" color="#0891b2" onClick={() => window.location.href = `tel:${p.customerPhone}`}/>
                )}
                {p.customerPhone && (
                  <ActionBtn icon="📱" label="WhatsApp" color="#25D366" onClick={() => {
                    const msg = `नमस्ते ${p.customerName} जी 🙏\n\nआपकी ${p.vehicleModel || 'bike'} pickup/drop service के बारे में बात करनी थी।\n\n- VP Honda Team`;
                    sendWhatsApp(p.customerPhone, msg);
                  }}/>
                )}
                {(p.pickupLat && p.pickupLng) && (
                  <ActionBtn icon={<Navigation size={12}/>} label="Map" color="#ea580c" onClick={() => {
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.pickupLat},${p.pickupLng}`, '_blank');
                  }}/>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 14, width: '100%', maxWidth: 520, padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>🛵 Schedule Pickup/Drop</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18}/>
              </button>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <label style={lbl}>Type *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <TypeBtn active={formData.type === 'pickup'} label="🛵 Pickup" onClick={() => setFormData({...formData, type: 'pickup'})}/>
                  <TypeBtn active={formData.type === 'drop'} label="🏠 Drop" onClick={() => setFormData({...formData, type: 'drop'})}/>
                </div>
              </div>
              <Field label="Customer Name *" value={formData.customerName} onChange={v => setFormData({...formData, customerName: v.toUpperCase()})}/>
              <Field label="Phone" value={formData.customerPhone} onChange={v => setFormData({...formData, customerPhone: v.replace(/\D/g,'')})} maxLength={10}/>
              <Field label="Vehicle Model" value={formData.vehicleModel} onChange={v => setFormData({...formData, vehicleModel: v})} placeholder="e.g., ACTIVA STD"/>
              <Field label="Reg No" value={formData.vehicleRegNo} onChange={v => setFormData({...formData, vehicleRegNo: v.toUpperCase()})} placeholder="e.g., MP04 ER 1234"/>
              <Field label="Pickup Address *" value={formData.pickupAddress} onChange={v => setFormData({...formData, pickupAddress: v})} placeholder="पूरा address"/>
              <Field label="Notes" value={formData.notes} onChange={v => setFormData({...formData, notes: v})}/>
              <Field label="Handled By (कर्मचारी)" value={formData.handledBy} onChange={v => setFormData({...formData, handledBy: v})}/>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={handleScheduleNew} disabled={busy}
                style={{ flex: 1, background: 'linear-gradient(135deg, #DC0000, #B91C1C)', color: '#fff', border: 'none', padding: '12px', borderRadius: 10, fontWeight: 800, cursor: busy ? 'wait' : 'pointer' }}>
                {busy ? '⏳ Saving...' : '💾 Schedule + Notify Customer'}
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
      <input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || ''} maxLength={maxLength} style={inputStyle}/>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ background: `linear-gradient(135deg, ${color}22, ${color}08)`, border: `1px solid ${color}40`, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 18 }}>{icon}</div>
      <p style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, margin: '4px 0 2px', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: 0, lineHeight: 1.1 }}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    scheduled:   { bg: '#ea580c', text: '⏰ Scheduled' },
    'in-transit':{ bg: '#3b82f6', text: '🚚 In Transit' },
    completed:   { bg: '#16a34a', text: '✅ Done' },
    cancelled:   { bg: '#7f1d1d', text: '❌ Cancelled' },
  };
  const s = map[status] || map.scheduled;
  return (
    <span style={{ background: s.bg, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
      {s.text}
    </span>
  );
}

const statusBorder = (status) => ({
  scheduled: '#ea580c55',
  'in-transit': '#3b82f655',
  completed: '#16a34a55',
  cancelled: '#7f1d1d55',
}[status] || '#1e293b');

function ActionBtn({ icon, label, color, onClick }) {
  return (
    <button onClick={onClick}
      style={{ background: color, color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
      {icon} {label}
    </button>
  );
}

function TypeBtn({ active, label, onClick }) {
  return (
    <button onClick={onClick}
      style={{ flex: 1, background: active ? '#DC0000' : '#1e293b', color: '#fff', border: '1px solid ' + (active ? '#DC0000' : '#475569'), padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
      {label}
    </button>
  );
}