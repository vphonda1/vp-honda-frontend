// ════════════════════════════════════════════════════════════════════════════
// SmartCustomerHub.jsx — VP Honda Customer Experience Center
// ════════════════════════════════════════════════════════════════════════════
// Combines Tier 2 features:
// • Customer Self-Service (search by phone, see history)
// • Service Rating & Feedback
// • Loyalty Program (points, tiers, rewards)
// • Smart Reminders (auto-trigger upcoming services)
// • Birthday wishes today
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Gift, Bell, Heart, Phone, Search, Award, Calendar, Send, ChevronRight } from 'lucide-react';
import {
  sendWhatsApp, buildServiceReminderWA, buildBirthdayWA, buildCustomWA,
  getServiceSchedule, checkExpiry, showInAppToast
} from '../utils/smartUtils';
import { api } from '../utils/apiConfig';

// ════════════════════════════════════════════════════════════════════════════
// LOYALTY TIERS (configurable)
// ════════════════════════════════════════════════════════════════════════════
const LOYALTY_TIERS = [
  { name: 'Bronze',   minPoints: 0,    badge: '🥉', color: '#a16207', perks: ['5% off accessories'] },
  { name: 'Silver',   minPoints: 500,  badge: '🥈', color: '#94a3b8', perks: ['10% off accessories', 'Free 1 wash/month'] },
  { name: 'Gold',     minPoints: 1500, badge: '🥇', color: '#eab308', perks: ['15% off accessories', 'Free 2 washes/month', 'Priority service'] },
  { name: 'Platinum', minPoints: 3000, badge: '💎', color: '#06b6d4', perks: ['20% off everything', 'Free pickup-drop', 'VIP service slots', 'Birthday discount 25%'] },
];

const getCustomerTier = (points) => {
  return LOYALTY_TIERS.slice().reverse().find(t => points >= t.minPoints) || LOYALTY_TIERS[0];
};

const getNextTier = (points) => {
  return LOYALTY_TIERS.find(t => points < t.minPoints);
};

// Points calculation
const POINTS_RULES = {
  perVehiclePurchase: 100,
  perServiceVisit: 25,
  perReferral: 50,
  perReview: 10,
  birthdayBonus: 100,
};

export default function SmartCustomerHub({ user }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('reminders');  // reminders | rating | loyalty | birthday | selfservice
  const [customers, setCustomers] = useState([]);
  const [serviceData, setServiceData] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [custRes, srvRes] = await Promise.all([
        fetch(api('/api/customers')).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(api('/api/service-data')).then(r => r.ok ? r.json() : []).catch(() => []),
      ]);
      setCustomers(custRes || []);
      setServiceData(srvRes || []);
      setRatings(JSON.parse(localStorage.getItem('vp_ratings') || '[]'));
    } catch (e) {
      console.log('Load failed:', e);
    }
    setLoading(false);
  };

  // ────────── REMINDERS DATA ──────────
  const dueReminders = customers.flatMap(c => {
    const purchaseDate = c.linkedVehicle?.purchaseDate || c.purchaseDate;
    if (!purchaseDate) return [];
    const schedule = getServiceSchedule(purchaseDate);
    return schedule
      .filter(s => s.status === 'overdue' || s.status === 'upcoming')
      .map(s => ({
        customer: c,
        service: s,
        priority: s.status === 'overdue' ? 1 : 2,
      }));
  }).sort((a, b) => a.priority - b.priority || a.service.daysRemaining - b.service.daysRemaining);

  // ────────── BIRTHDAYS ──────────
  const todayBirthdays = customers.filter(c => {
    if (!c.dob) return false;
    const dob = new Date(c.dob);
    const today = new Date();
    return dob.getDate() === today.getDate() && dob.getMonth() === today.getMonth();
  });

  const upcomingBirthdays = customers.filter(c => {
    if (!c.dob) return false;
    const dob = new Date(c.dob);
    const today = new Date();
    const thisYearBday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
    if (thisYearBday < today) thisYearBday.setFullYear(today.getFullYear() + 1);
    const days = Math.ceil((thisYearBday - today) / (1000 * 60 * 60 * 24));
    return days > 0 && days <= 30;
  }).sort((a, b) => {
    const da = new Date(a.dob), db = new Date(b.dob);
    return (da.getMonth() * 31 + da.getDate()) - (db.getMonth() * 31 + db.getDate());
  });

  // ────────── LOYALTY DATA ──────────
  const customersWithPoints = customers.map(c => {
    const phone = c.phone || c.mobileNo;
    const customerServices = serviceData.filter(s => s.phone === phone || s.mobileNo === phone);
    const points =
      (c._id ? POINTS_RULES.perVehiclePurchase : 0) +    // 100 for purchase
      (customerServices.length * POINTS_RULES.perServiceVisit) +
      (Number(c.loyaltyBonus || 0));
    const tier = getCustomerTier(points);
    return { ...c, points, tier, serviceCount: customerServices.length };
  }).sort((a, b) => b.points - a.points);

  // ────────── SELF-SERVICE SEARCH ──────────
  const searchedCustomer = searchQuery.length >= 4
    ? customers.find(c =>
        (c.phone || c.mobileNo || '').includes(searchQuery) ||
        (c.name || c.customerName || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  // ────────── ACTIONS ──────────
  const handleSendReminder = (item) => {
    const c = item.customer;
    const phone = c.phone || c.mobileNo;
    if (!phone) {
      alert('❌ Phone नहीं है');
      return;
    }
    const msg = buildServiceReminderWA(
      { name: c.name || c.customerName, vehicle: c.linkedVehicle?.model || c.vehicleModel },
      item.service.num,
      item.service.dueDateFormatted
    );
    sendWhatsApp(phone, msg);
    showInAppToast('📱 Reminder भेजा गया', `${c.name || c.customerName} को service reminder gaया`, 'success');
  };

  const handleSendBirthday = (c) => {
    const phone = c.phone || c.mobileNo;
    if (!phone) { alert('❌ Phone नहीं है'); return; }
    const msg = buildBirthdayWA({ name: c.name || c.customerName });
    sendWhatsApp(phone, msg);
    showInAppToast('🎂 Birthday wish भेज दी', '', 'success');
  };

  const handleBulkSendReminders = () => {
    const overdueOnly = dueReminders.filter(r => r.service.status === 'overdue');
    if (overdueOnly.length === 0) { alert('कोई overdue reminder नहीं है'); return; }
    if (!window.confirm(`${overdueOnly.length} customers को service reminder भेजना है?\n\nहर customer के लिए WhatsApp tab खुलेगी।`)) return;
    overdueOnly.slice(0, 10).forEach((item, i) => {
      setTimeout(() => handleSendReminder(item), i * 1500);
    });
  };

  // ────────── RENDER ──────────
  return (
    <div style={{ padding: 16, background: '#020617', minHeight: '100vh', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Heart size={22} color="#DC0000"/> Customer Hub
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0 0' }}>
          Reminders, Loyalty, Ratings, Birthdays — सब एक जगह
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', borderBottom: '1px solid #1e293b', paddingBottom: 10 }}>
        <Tab id="reminders"  label={`🔔 Reminders (${dueReminders.length})`} active={activeTab === 'reminders'} onClick={() => setActiveTab('reminders')}/>
        <Tab id="loyalty"    label={`💎 Loyalty (${customersWithPoints.length})`} active={activeTab === 'loyalty'} onClick={() => setActiveTab('loyalty')}/>
        <Tab id="rating"     label={`⭐ Ratings (${ratings.length})`} active={activeTab === 'rating'} onClick={() => setActiveTab('rating')}/>
        <Tab id="birthday"   label={`🎂 Birthday (${todayBirthdays.length})`} active={activeTab === 'birthday'} onClick={() => setActiveTab('birthday')}/>
        <Tab id="selfservice" label="🔍 Self-Service" active={activeTab === 'selfservice'} onClick={() => setActiveTab('selfservice')}/>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>⏳ Loading...</div>
      )}

      {/* ═══ REMINDERS TAB ═══ */}
      {!loading && activeTab === 'reminders' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p style={{ color: '#fbbf24', fontSize: 13, fontWeight: 700, margin: 0 }}>
                {dueReminders.filter(r => r.service.status === 'overdue').length} Overdue · {dueReminders.filter(r => r.service.status === 'upcoming').length} Upcoming
              </p>
              <p style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>Honda की 5 free services के अनुसार calculate</p>
            </div>
            {dueReminders.filter(r => r.service.status === 'overdue').length > 0 && (
              <button onClick={handleBulkSendReminders}
                style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                📱 सबको Reminder भेजें
              </button>
            )}
          </div>
          {dueReminders.length === 0 ? (
            <EmptyState icon="✨" message="कोई service reminder pending नहीं है!"/>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {dueReminders.slice(0, 50).map((item, i) => (
                <ReminderCard key={i} item={item} onSend={handleSendReminder}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ LOYALTY TAB ═══ */}
      {!loading && activeTab === 'loyalty' && (
        <div>
          {/* Tier Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 14 }}>
            {LOYALTY_TIERS.map(t => {
              const count = customersWithPoints.filter(c => c.tier.name === t.name).length;
              return (
                <div key={t.name} style={{
                  background: `linear-gradient(135deg, ${t.color}22, ${t.color}08)`,
                  border: `1px solid ${t.color}66`,
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <div style={{ fontSize: 22 }}>{t.badge}</div>
                  <p style={{ color: t.color, fontSize: 12, fontWeight: 800, margin: '4px 0 2px' }}>{t.name}</p>
                  <p style={{ color: '#fff', fontSize: 18, fontWeight: 900, margin: 0 }}>{count}</p>
                  <p style={{ color: '#64748b', fontSize: 10, margin: '4px 0 0' }}>{t.minPoints}+ points</p>
                </div>
              );
            })}
          </div>

          {/* Top Loyalty Customers */}
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' }}>🏆 Top Loyal Customers</h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {customersWithPoints.slice(0, 30).map((c, i) => (
              <LoyaltyCard key={c._id || i} customer={c} rank={i + 1}/>
            ))}
          </div>
        </div>
      )}

      {/* ═══ RATING TAB ═══ */}
      {!loading && activeTab === 'rating' && (
        <div>
          <RatingDashboard ratings={ratings}/>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: '16px 0 8px', textTransform: 'uppercase' }}>📝 Recent Ratings</h3>
          {ratings.length === 0 ? (
            <EmptyState icon="⭐" message="अभी कोई rating नहीं मिली। Service complete के बाद customer से ratings collect करें।"/>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {ratings.slice(0, 30).map((r, i) => <RatingCard key={i} rating={r}/>)}
            </div>
          )}
          <button onClick={() => {
            const phone = prompt('Customer का mobile डालें:');
            if (!phone) return;
            const c = customers.find(x => (x.phone || x.mobileNo) === phone);
            if (!c) { alert('Customer नहीं मिला'); return; }
            const msg = buildCustomWA(
              `नमस्ते ${c.name || c.customerName} जी 🙏`,
              `कृपया हमें rate करें — आपकी राय हमारे लिए कीमती है!\n\n👉 इस link पर जाएं और 5-star दें:\n${window.location.origin}/rate?phone=${phone}\n\nधन्यवाद!`
            );
            sendWhatsApp(phone, msg);
          }} style={{ marginTop: 16, background: '#fbbf24', color: '#000', border: 'none', padding: '10px 16px', borderRadius: 8, fontWeight: 800, cursor: 'pointer' }}>
            📤 Rating Link भेजें
          </button>
        </div>
      )}

      {/* ═══ BIRTHDAY TAB ═══ */}
      {!loading && activeTab === 'birthday' && (
        <div>
          {todayBirthdays.length > 0 && (
            <div style={{ background: 'linear-gradient(135deg, #DC000022, #DC000008)', border: '1px solid #DC000077', borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <h3 style={{ color: '#fbbf24', fontSize: 14, fontWeight: 800, marginBottom: 10 }}>🎉 आज के Birthday Boys/Girls!</h3>
              <div style={{ display: 'grid', gap: 6 }}>
                {todayBirthdays.map((c, i) => (
                  <BirthdayCard key={i} customer={c} isToday onSend={handleSendBirthday}/>
                ))}
              </div>
            </div>
          )}
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' }}>📅 अगले 30 दिन में Birthdays</h3>
          {upcomingBirthdays.length === 0 ? (
            <EmptyState icon="🎂" message="अगले 30 दिन में कोई birthday नहीं"/>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {upcomingBirthdays.map((c, i) => <BirthdayCard key={i} customer={c} onSend={handleSendBirthday}/>)}
            </div>
          )}
        </div>
      )}

      {/* ═══ SELF-SERVICE TAB ═══ */}
      {!loading && activeTab === 'selfservice' && (
        <div>
          <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>
            💡 Customer अपना phone number डालकर अपना पूरा record देख सकता है — service history, due dates, loyalty points
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Mobile number या name..."
              style={{ flex: 1, background: '#1e293b', color: '#fff', border: '1px solid #475569', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none' }}
            />
            <button onClick={() => setSearchQuery('')}
              style={{ background: '#475569', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
              Clear
            </button>
          </div>
          {searchedCustomer ? (
            <CustomerSelfServiceView customer={searchedCustomer} services={serviceData} onSendReminder={handleSendReminder}/>
          ) : searchQuery.length >= 4 ? (
            <EmptyState icon="🔍" message={`"${searchQuery}" से कोई customer नहीं मिला`}/>
          ) : (
            <EmptyState icon="🔍" message="कम से कम 4 अक्षर डालें"/>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SUB COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

function Tab({ id, label, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        background: active ? '#DC0000' : '#1e293b',
        color: '#fff', border: 'none',
        padding: '8px 14px', borderRadius: 8,
        fontSize: 12, fontWeight: 700, cursor: 'pointer',
      }}>
      {label}
    </button>
  );
}

function EmptyState({ icon, message }) {
  return (
    <div style={{ textAlign: 'center', padding: 40, color: '#64748b', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12 }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
      <p style={{ margin: 0 }}>{message}</p>
    </div>
  );
}

function ReminderCard({ item, onSend }) {
  const c = item.customer;
  const s = item.service;
  const isOverdue = s.status === 'overdue';
  return (
    <div style={{
      background: '#0f172a',
      border: `1px solid ${isOverdue ? '#dc262655' : '#ea580c55'}`,
      borderRadius: 10, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap'
    }}>
      <div style={{ fontSize: 20 }}>{isOverdue ? '🚨' : '⏰'}</div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>{c.name || c.customerName}</p>
        <p style={{ color: '#94a3b8', fontSize: 11, margin: '3px 0 0' }}>
          🏍️ {c.linkedVehicle?.model || c.vehicleModel || 'Vehicle'} · {s.label}
        </p>
        <p style={{ color: isOverdue ? '#fca5a5' : '#fdba74', fontSize: 11, fontWeight: 600, margin: '3px 0 0' }}>
          {isOverdue ? `🚨 Overdue ${Math.abs(s.daysRemaining)} दिन से` : `⏰ ${s.daysRemaining} दिन में due`}
          · 📅 {s.dueDateFormatted}
        </p>
      </div>
      <button onClick={() => onSend(item)}
        style={{ background: '#25D366', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
        📱 Remind
      </button>
    </div>
  );
}

function LoyaltyCard({ customer, rank }) {
  const t = customer.tier;
  const next = getNextTier(customer.points);
  const progress = next ? Math.round((customer.points / next.minPoints) * 100) : 100;
  return (
    <div style={{
      background: '#0f172a',
      border: `1px solid ${t.color}44`,
      borderRadius: 10, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap'
    }}>
      <div style={{ background: `${t.color}33`, width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
        {t.badge}
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>
          #{rank} {customer.name || customer.customerName}
          <span style={{ background: t.color, color: '#000', padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 800, marginLeft: 6 }}>
            {t.name}
          </span>
        </p>
        <p style={{ color: '#94a3b8', fontSize: 11, margin: '3px 0 0' }}>
          📞 {customer.phone || customer.mobileNo || '-'} · {customer.serviceCount || 0} services
        </p>
        {next && (
          <div style={{ marginTop: 4 }}>
            <div style={{ height: 4, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: t.color }}/>
            </div>
            <p style={{ color: '#64748b', fontSize: 9, margin: '3px 0 0' }}>
              {next.minPoints - customer.points} points to {next.name} {next.badge}
            </p>
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ color: t.color, fontSize: 18, fontWeight: 900, margin: 0 }}>{customer.points}</p>
        <p style={{ color: '#64748b', fontSize: 9, margin: 0 }}>POINTS</p>
      </div>
    </div>
  );
}

function RatingDashboard({ ratings }) {
  if (ratings.length === 0) return null;
  const avg = (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length).toFixed(1);
  const dist = [5, 4, 3, 2, 1].map(s => ({
    stars: s,
    count: ratings.filter(r => r.stars === s).length,
    pct: ratings.length > 0 ? Math.round((ratings.filter(r => r.stars === s).length / ratings.length) * 100) : 0,
  }));
  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: '#fbbf24', fontSize: 36, fontWeight: 900, margin: 0, lineHeight: 1 }}>{avg}</p>
          <div style={{ color: '#fbbf24', fontSize: 16 }}>{'★'.repeat(Math.round(avg))}{'☆'.repeat(5 - Math.round(avg))}</div>
          <p style={{ color: '#64748b', fontSize: 11, margin: '4px 0 0' }}>{ratings.length} ratings</p>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          {dist.map(d => (
            <div key={d.stars} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ color: '#fbbf24', fontSize: 11, width: 32 }}>{d.stars}★</span>
              <div style={{ flex: 1, height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${d.pct}%`, height: '100%', background: '#fbbf24' }}/>
              </div>
              <span style={{ color: '#94a3b8', fontSize: 10, width: 36, textAlign: 'right' }}>{d.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RatingCard({ rating }) {
  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>{rating.customerName}</span>
        <span style={{ color: '#fbbf24', fontSize: 14 }}>{'★'.repeat(rating.stars)}{'☆'.repeat(5 - rating.stars)}</span>
      </div>
      {rating.feedback && <p style={{ color: '#cbd5e1', fontSize: 12, fontStyle: 'italic', margin: '4px 0 0' }}>"{rating.feedback}"</p>}
      <p style={{ color: '#64748b', fontSize: 10, margin: '4px 0 0' }}>
        {rating.servicedBy && `👤 ${rating.servicedBy} · `}
        🕐 {new Date(rating.date).toLocaleDateString('en-IN')}
      </p>
    </div>
  );
}

function BirthdayCard({ customer, isToday, onSend }) {
  const dob = new Date(customer.dob);
  const today = new Date();
  const thisYearBday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  if (thisYearBday < today) thisYearBday.setFullYear(today.getFullYear() + 1);
  const days = isToday ? 0 : Math.ceil((thisYearBday - today) / (1000 * 60 * 60 * 24));
  return (
    <div style={{
      background: isToday ? 'linear-gradient(135deg, #DC000033, #DC000011)' : '#0f172a',
      border: `1px solid ${isToday ? '#DC0000' : '#1e293b'}`,
      borderRadius: 10, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap'
    }}>
      <div style={{ fontSize: 22 }}>{isToday ? '🎉' : '🎂'}</div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>{customer.name || customer.customerName}</p>
        <p style={{ color: '#94a3b8', fontSize: 11, margin: '3px 0 0' }}>
          📞 {customer.phone || customer.mobileNo || '-'} · 📅 {dob.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          {!isToday && ` · ${days} दिन में`}
        </p>
      </div>
      <button onClick={() => onSend(customer)}
        style={{ background: '#DC0000', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
        🎂 Wish
      </button>
    </div>
  );
}

function CustomerSelfServiceView({ customer, services, onSendReminder }) {
  const phone = customer.phone || customer.mobileNo;
  const myServices = services.filter(s => s.phone === phone || s.mobileNo === phone);
  const purchaseDate = customer.linkedVehicle?.purchaseDate || customer.purchaseDate;
  const schedule = purchaseDate ? getServiceSchedule(purchaseDate) : [];
  const insuranceCheck = checkExpiry(customer.linkedVehicle?.insuranceExpiry, 'Insurance');
  const points = (customer._id ? POINTS_RULES.perVehiclePurchase : 0) + myServices.length * POINTS_RULES.perServiceVisit;
  const tier = getCustomerTier(points);

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {/* Customer Card */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a8a22, #1e3a8a08)', border: '1px solid #3b82f655', borderRadius: 12, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{customer.name || customer.customerName}</h3>
            <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0' }}>📞 {phone}</p>
            <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>📍 {customer.address || '-'}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24 }}>{tier.badge}</div>
            <p style={{ color: tier.color, fontSize: 12, fontWeight: 800, margin: '4px 0 0' }}>{tier.name}</p>
            <p style={{ color: '#fff', fontSize: 18, fontWeight: 900, margin: 0 }}>{points} pts</p>
          </div>
        </div>
      </div>

      {/* Vehicle Info */}
      {(customer.linkedVehicle?.model || customer.vehicleModel) && (
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 14 }}>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' }}>🏍️ Vehicle</h4>
          <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            {customer.linkedVehicle?.model || customer.vehicleModel}
          </p>
          <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0' }}>
            🎨 {customer.linkedVehicle?.color || customer.color || '-'} ·
            🔢 {customer.linkedVehicle?.regNo || customer.regNo || '-'}
          </p>
          {purchaseDate && (
            <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
              📅 Purchased: {new Date(purchaseDate).toLocaleDateString('en-IN')}
            </p>
          )}
        </div>
      )}

      {/* Service Schedule */}
      {schedule.length > 0 && (
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 14 }}>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' }}>📅 Service Schedule</h4>
          {schedule.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < schedule.length - 1 ? '1px solid #1e293b' : 'none' }}>
              <span style={{ fontSize: 16 }}>{s.status === 'overdue' ? '🚨' : s.status === 'upcoming' ? '⏰' : '✅'}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>{s.label}</p>
                <p style={{ color: '#94a3b8', fontSize: 11, margin: '2px 0 0' }}>
                  {s.dueDateFormatted} · {s.km} km
                  {s.status === 'overdue' ? ` · 🚨 ${Math.abs(s.daysRemaining)} दिन overdue` :
                   s.status === 'upcoming' ? ` · ${s.daysRemaining} दिन में` : ` · ${s.daysRemaining} दिन बाद`}
                </p>
              </div>
              {(s.status === 'overdue' || s.status === 'upcoming') && (
                <button onClick={() => onSendReminder({ customer, service: s })}
                  style={{ background: '#25D366', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                  📱
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Service History */}
      {myServices.length > 0 && (
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 14 }}>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' }}>🔧 Service History ({myServices.length})</h4>
          {myServices.slice(0, 10).map((s, i) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: i < 9 ? '1px solid #1e293b' : 'none' }}>
              <p style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>
                {s.serviceType || `Service #${i + 1}`} · ₹{(s.amount || 0).toLocaleString('en-IN')}
              </p>
              <p style={{ color: '#94a3b8', fontSize: 10, margin: '2px 0 0' }}>
                📅 {s.date ? new Date(s.date).toLocaleDateString('en-IN') : '-'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Insurance Alert */}
      {insuranceCheck && insuranceCheck.status !== 'ok' && (
        <div style={{ background: insuranceCheck.status === 'expired' ? '#7f1d1d' : '#7c2d12', border: '1px solid #ef4444', borderRadius: 10, padding: 12 }}>
          <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>
            {insuranceCheck.status === 'expired' ? '🚨' : '⚠️'} Insurance Alert
          </p>
          <p style={{ fontSize: 12, margin: '4px 0 0' }}>{insuranceCheck.msg}</p>
        </div>
      )}
    </div>
  );
}