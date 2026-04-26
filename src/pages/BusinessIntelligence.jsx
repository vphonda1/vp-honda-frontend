// ════════════════════════════════════════════════════════════════════════════
// BusinessIntelligence.jsx — VP Honda Advanced Analytics & Predictions
// ════════════════════════════════════════════════════════════════════════════
// Combines Tier 3 features:
// • AI Predictions (next month sales, trending models)
// • Advanced Analytics (employee performance, model profitability)
// • Profit Calculator (live)
// • Target & Achievement Tracker
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Target, Brain, DollarSign, Award, Zap, BarChart2, ChevronUp, ChevronDown } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Area, AreaChart } from 'recharts';
import { api } from '../utils/apiConfig';

const COLORS = ['#DC0000', '#3b82f6', '#16a34a', '#ea580c', '#a855f7', '#06b6d4', '#eab308', '#ec4899'];

export default function BusinessIntelligence({ user }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('predictions');
  const [data, setData] = useState({ customers: [], invoices: [], services: [], staff: [], oldBikes: [] });
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState(() => JSON.parse(localStorage.getItem('vp_targets') || '{}'));

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [customers, invoices, services, staff, oldBikes] = await Promise.all([
        fetch(api('/api/customers')).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(api('/api/invoices')).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(api('/api/service-data')).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(api('/api/staff')).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(api('/api/oldbikes')).then(r => r.ok ? r.json() : []).catch(() => []),
      ]);
      setData({ customers, invoices, services, staff, oldBikes });
    } catch {}
    setLoading(false);
  };

  const saveTargets = (newTargets) => {
    setTargets(newTargets);
    localStorage.setItem('vp_targets', JSON.stringify(newTargets));
  };

  // ────────── ANALYTICS COMPUTATIONS ──────────
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthStart = new Date(currentYear, currentMonth, 1);
  const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
  const lastMonthEnd = new Date(currentYear, currentMonth, 0);

  // Revenue this month vs last month
  const thisMonthInvoices = data.invoices.filter(i => {
    const d = new Date(i.invoiceDate || i.date);
    return d >= monthStart;
  });
  const lastMonthInvoices = data.invoices.filter(i => {
    const d = new Date(i.invoiceDate || i.date);
    return d >= lastMonthStart && d <= lastMonthEnd;
  });
  const thisMonthRevenue = thisMonthInvoices.reduce((s, i) => s + Number(i.price || 0), 0);
  const lastMonthRevenue = lastMonthInvoices.reduce((s, i) => s + Number(i.price || 0), 0);
  const revenueGrowth = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100) : 0;

  // ────────── AI PREDICTIONS ──────────
  // Simple linear projection based on last 6 months
  const monthlySales = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(currentYear, currentMonth - i, 1);
    const end = new Date(currentYear, currentMonth - i + 1, 0);
    const monthInvoices = data.invoices.filter(inv => {
      const d = new Date(inv.invoiceDate || inv.date);
      return d >= start && d <= end;
    });
    monthlySales.push({
      month: start.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      revenue: monthInvoices.reduce((s, inv) => s + Number(inv.price || 0), 0),
      count: monthInvoices.length,
    });
  }

  // Linear trend: simple slope average
  const avgGrowth = monthlySales.length >= 2 ?
    monthlySales.slice(1).reduce((s, m, i) => s + (m.count - monthlySales[i].count), 0) / (monthlySales.length - 1) : 0;
  const predictedNextMonth = Math.max(0, Math.round((monthlySales[monthlySales.length - 1]?.count || 0) + avgGrowth));
  const predictedRevenue = monthlySales.length > 0 ?
    Math.round(monthlySales.reduce((s, m) => s + m.revenue, 0) / monthlySales.length * (1 + (revenueGrowth / 100))) : 0;

  // Trending models (bought most in last 60 days)
  const recentInvoices = data.invoices.filter(i => {
    const d = new Date(i.invoiceDate || i.date);
    return (now - d) / (1000 * 60 * 60 * 24) <= 60;
  });
  const modelCounts = {};
  recentInvoices.forEach(i => {
    const m = i.vehicleModel || 'Unknown';
    modelCounts[m] = (modelCounts[m] || 0) + 1;
  });
  const trendingModels = Object.entries(modelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([model, count]) => ({ model, count, pct: Math.round((count / recentInvoices.length) * 100) }));

  // Customers likely to return (haven't visited in 6 months but were active before)
  const potentialReturnees = data.customers.filter(c => {
    const services = data.services.filter(s =>
      (s.phone === c.phone || s.mobileNo === c.phone) && s.date
    );
    if (services.length < 2) return false;
    const lastService = Math.max(...services.map(s => new Date(s.date).getTime()));
    const daysSince = (now - lastService) / (1000 * 60 * 60 * 24);
    return daysSince > 180 && daysSince < 365;
  }).slice(0, 10);

  // ────────── EMPLOYEE PERFORMANCE ──────────
  const employeeStats = data.staff.map(s => {
    const sales = data.invoices.filter(i => i.handledBy === s.name || i.salesperson === s.name).length;
    const services = data.services.filter(sv => sv.servicedBy === s.name || sv.handledBy === s.name).length;
    return {
      name: s.name,
      position: s.position,
      sales,
      services,
      total: sales + services,
    };
  }).sort((a, b) => b.total - a.total);

  // ────────── MODEL PROFITABILITY ──────────
  const modelStats = {};
  data.invoices.forEach(i => {
    const m = i.vehicleModel || 'Unknown';
    if (!modelStats[m]) modelStats[m] = { count: 0, revenue: 0, model: m };
    modelStats[m].count++;
    modelStats[m].revenue += Number(i.price || 0);
  });
  const topModels = Object.values(modelStats)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
    .map(m => ({ ...m, avgPrice: Math.round(m.revenue / m.count) }));

  // ────────── PROFIT CALCULATOR ──────────
  const totalRevenue = data.invoices.reduce((s, i) => s + Number(i.price || 0), 0);
  // Assumptions for profit calculation (typical Honda dealer margins)
  const VEHICLE_MARGIN_PCT = 5;     // 5% margin on vehicle sales
  const SERVICE_REVENUE = data.services.reduce((s, sv) => s + Number(sv.amount || 0), 0);
  const SERVICE_MARGIN_PCT = 40;    // 40% margin on service
  
  const vehicleProfit = (totalRevenue * VEHICLE_MARGIN_PCT) / 100;
  const serviceProfit = (SERVICE_REVENUE * SERVICE_MARGIN_PCT) / 100;
  const totalProfit = vehicleProfit + serviceProfit;

  // ────────── TARGETS ──────────
  const monthTarget = targets[`${currentYear}-${currentMonth}`] || { sales: 50, revenue: 4000000 };
  const salesAchieved = thisMonthInvoices.length;
  const revenueAchievedPct = Math.round((thisMonthRevenue / monthTarget.revenue) * 100);
  const salesAchievedPct = Math.round((salesAchieved / monthTarget.sales) * 100);
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysPassed = now.getDate();
  const daysRemaining = daysInMonth - daysPassed;
  const expectedPaceSales = Math.round((monthTarget.sales / daysInMonth) * daysPassed);
  const expectedPaceRevenue = Math.round((monthTarget.revenue / daysInMonth) * daysPassed);

  // ────────── RENDER ──────────
  return (
    <div style={{ padding: 16, background: '#020617', minHeight: '100vh', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={22} color="#a855f7"/> Business Intelligence
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0 0' }}>
          AI Predictions · Advanced Analytics · Profit Tracking · Targets
        </p>
      </div>

      {/* Top Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 14 }}>
        <BigStat icon="💰" label="This Month Revenue" value={`₹${(thisMonthRevenue / 100000).toFixed(2)}L`}
          trend={revenueGrowth} color="#16a34a"/>
        <BigStat icon="🏍️" label="Vehicles Sold" value={thisMonthInvoices.length}
          subValue={`${lastMonthInvoices.length} last month`} color="#3b82f6"/>
        <BigStat icon="📈" label="Predicted Next Month" value={predictedNextMonth}
          subValue={`₹${(predictedRevenue / 100000).toFixed(2)}L`} color="#a855f7"/>
        <BigStat icon="💎" label="Net Profit (est.)" value={`₹${(totalProfit / 100000).toFixed(2)}L`}
          subValue="based on margins" color="#fbbf24"/>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', borderBottom: '1px solid #1e293b', paddingBottom: 10 }}>
        <Tab label="🔮 AI Predictions" active={activeTab === 'predictions'} onClick={() => setActiveTab('predictions')}/>
        <Tab label="📊 Analytics" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')}/>
        <Tab label="💰 Profit" active={activeTab === 'profit'} onClick={() => setActiveTab('profit')}/>
        <Tab label="🎯 Targets" active={activeTab === 'targets'} onClick={() => setActiveTab('targets')}/>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>⏳ Analyzing...</div>}

      {/* ═══ PREDICTIONS TAB ═══ */}
      {!loading && activeTab === 'predictions' && (
        <div>
          {/* 6-month trend */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#a855f7' }}>🔮 6-Month Trend & Prediction</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={[...monthlySales, { month: 'Next (predicted)', revenue: predictedRevenue, count: predictedNextMonth, predicted: true }]}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3"/>
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }}/>
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }}/>
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} formatter={(v) => `₹${(v / 1000).toFixed(0)}k`}/>
                <Area type="monotone" dataKey="revenue" stroke="#a855f7" fill="#a855f733"/>
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ background: 'linear-gradient(135deg, #a855f722, #a855f708)', border: '1px solid #a855f755', borderRadius: 8, padding: 10, marginTop: 10 }}>
              <p style={{ color: '#a855f7', fontSize: 12, fontWeight: 700, margin: 0 }}>🤖 AI Insight:</p>
              <p style={{ color: '#cbd5e1', fontSize: 12, margin: '4px 0 0' }}>
                {avgGrowth > 0 ? '📈 Sales बढ़ रही हैं' : avgGrowth < 0 ? '📉 Sales गिर रही हैं' : '📊 Sales stable हैं'} —
                अगले महीने लगभग <b style={{ color: '#fff' }}>{predictedNextMonth} vehicles</b> बिकने का अनुमान है,
                approx <b style={{ color: '#fff' }}>₹{(predictedRevenue / 100000).toFixed(2)}L</b> revenue।
              </p>
            </div>
          </div>

          {/* Trending Models */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#fbbf24' }}>🔥 Trending Models (last 60 days)</h3>
            {trendingModels.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: 12 }}>Recent data नहीं है</p>
            ) : trendingModels.map((m, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {i === 0 && '🥇 '}{i === 1 && '🥈 '}{i === 2 && '🥉 '}
                    {m.model}
                  </span>
                  <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 12 }}>{m.count} sold ({m.pct}%)</span>
                </div>
                <div style={{ height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${m.pct}%`, height: '100%', background: '#fbbf24' }}/>
                </div>
              </div>
            ))}
          </div>

          {/* Potential Returnees */}
          {potentialReturnees.length > 0 && (
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 14 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#22c55e' }}>
                🎯 Customers Likely to Return ({potentialReturnees.length})
              </h3>
              <p style={{ color: '#64748b', fontSize: 11, marginBottom: 10 }}>
                ये customers 6+ महीने से नहीं आए — follow-up कराएं
              </p>
              {potentialReturnees.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < potentialReturnees.length - 1 ? '1px solid #1e293b' : 'none' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{c.name}</p>
                    <p style={{ color: '#94a3b8', fontSize: 11, margin: '2px 0 0' }}>📞 {c.phone}</p>
                  </div>
                  <button onClick={() => navigate('/customers')}
                    style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    View →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ ANALYTICS TAB ═══ */}
      {!loading && activeTab === 'analytics' && (
        <div>
          {/* Top Models */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#3b82f6' }}>💰 Top Models by Revenue</h3>
            {topModels.length === 0 ? <p style={{ color: '#64748b', fontSize: 12 }}>Data नहीं है</p> : (
              <ResponsiveContainer width="100%" height={Math.max(220, topModels.length * 30)}>
                <BarChart data={topModels} layout="vertical">
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3"/>
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}/>
                  <YAxis dataKey="model" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={110}/>
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} formatter={(v) => `₹${v.toLocaleString('en-IN')}`}/>
                  <Bar dataKey="revenue" fill="#3b82f6"/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Employee Performance */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#16a34a' }}>👥 Employee Performance</h3>
            {employeeStats.length === 0 ? <p style={{ color: '#64748b', fontSize: 12 }}>Staff data नहीं है</p> :
              employeeStats.map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < employeeStats.length - 1 ? '1px solid #1e293b' : 'none' }}>
                  <div style={{ background: '#16a34a33', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>
                    {i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{e.name}</p>
                    <p style={{ color: '#94a3b8', fontSize: 11, margin: '2px 0 0' }}>{e.position}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: '#16a34a', fontSize: 16, fontWeight: 800, margin: 0 }}>{e.total}</p>
                    <p style={{ color: '#64748b', fontSize: 9, margin: '2px 0 0' }}>{e.sales} sales · {e.services} services</p>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ═══ PROFIT TAB ═══ */}
      {!loading && activeTab === 'profit' && (
        <div>
          <div style={{ background: 'linear-gradient(135deg, #16a34a22, #16a34a08)', border: '1px solid #16a34a55', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: '#86efac' }}>💰 Total Estimated Profit</h3>
            <p style={{ color: '#fff', fontSize: 32, fontWeight: 900, margin: '6px 0' }}>
              ₹{(totalProfit / 100000).toFixed(2)}L
            </p>
            <p style={{ color: '#94a3b8', fontSize: 11, margin: 0 }}>
              Vehicle sales (~5% margin) + Service revenue (~40% margin)
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <ProfitBreakdown icon="🏍️" label="Vehicle Sales Profit" revenue={totalRevenue} profit={vehicleProfit} marginPct={VEHICLE_MARGIN_PCT} color="#3b82f6"/>
            <ProfitBreakdown icon="🔧" label="Service Profit" revenue={SERVICE_REVENUE} profit={serviceProfit} marginPct={SERVICE_MARGIN_PCT} color="#ea580c"/>
          </div>

          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📊 Profit by Month</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlySales.map(m => ({ ...m, profit: m.revenue * 0.05 }))}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3"/>
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }}/>
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}/>
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} formatter={(v) => `₹${Math.round(v).toLocaleString('en-IN')}`}/>
                <Bar dataKey="profit" fill="#16a34a"/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <p style={{ color: '#64748b', fontSize: 11, marginTop: 10, fontStyle: 'italic' }}>
            ⓘ यह profit estimate है typical Honda dealer margins पर। वास्तविक profit GST, expenses, salary आदि के बाद कम हो सकता है।
          </p>
        </div>
      )}

      {/* ═══ TARGETS TAB ═══ */}
      {!loading && activeTab === 'targets' && (
        <div>
          <TargetEditor target={monthTarget} onSave={(t) => saveTargets({ ...targets, [`${currentYear}-${currentMonth}`]: t })}/>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
            {/* Sales Target */}
            <ProgressCard
              icon="🏍️" label="Sales Target"
              current={salesAchieved} target={monthTarget.sales}
              expectedPace={expectedPaceSales} unit="vehicles"
              color="#3b82f6"
            />
            <ProgressCard
              icon="💰" label="Revenue Target"
              current={thisMonthRevenue / 100000} target={monthTarget.revenue / 100000}
              expectedPace={expectedPaceRevenue / 100000} unit="L"
              color="#16a34a" formatValue={(v) => `₹${v.toFixed(2)}L`}
            />
          </div>

          {/* Days Remaining Card */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 14, marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ background: '#fbbf2433', width: 50, height: 50, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📅</div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Days remaining in month</p>
              <p style={{ fontSize: 28, fontWeight: 900, margin: '4px 0', color: '#fbbf24' }}>{daysRemaining}</p>
              <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
                Day {daysPassed} / {daysInMonth} ({Math.round((daysPassed / daysInMonth) * 100)}% of month done)
              </p>
            </div>
          </div>

          {/* Insights */}
          <div style={{ background: 'linear-gradient(135deg, #fbbf2422, #fbbf2408)', border: '1px solid #fbbf2455', borderRadius: 12, padding: 14, marginTop: 14 }}>
            <h3 style={{ color: '#fbbf24', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>💡 Insights</h3>
            {salesAchieved >= expectedPaceSales ? (
              <p style={{ color: '#86efac', fontSize: 12, margin: 0 }}>✅ Sales target के expected pace से आगे हैं — keep going!</p>
            ) : (
              <p style={{ color: '#fca5a5', fontSize: 12, margin: 0 }}>
                ⚠️ Sales: Expected pace {expectedPaceSales}, achieved {salesAchieved}.
                अगले {daysRemaining} दिन में target पूरा करने के लिए हर दिन
                <b style={{ color: '#fff' }}> {Math.ceil((monthTarget.sales - salesAchieved) / Math.max(1, daysRemaining))} sales</b> चाहिए।
              </p>
            )}
            {thisMonthRevenue >= expectedPaceRevenue ? (
              <p style={{ color: '#86efac', fontSize: 12, margin: '6px 0 0' }}>✅ Revenue target के expected pace से आगे है!</p>
            ) : (
              <p style={{ color: '#fca5a5', fontSize: 12, margin: '6px 0 0' }}>
                ⚠️ Revenue: ₹{((monthTarget.revenue - thisMonthRevenue) / 100000).toFixed(2)}L बाकी है target के लिए
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SUB COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

function Tab({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        background: active ? '#a855f7' : '#1e293b',
        color: '#fff', border: 'none',
        padding: '8px 14px', borderRadius: 8,
        fontSize: 12, fontWeight: 700, cursor: 'pointer',
      }}>
      {label}
    </button>
  );
}

function BigStat({ icon, label, value, subValue, trend, color }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}22, ${color}08)`,
      border: `1px solid ${color}44`,
      borderRadius: 12, padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 22 }}>{icon}</div>
        {trend !== undefined && (
          <span style={{
            color: trend >= 0 ? '#86efac' : '#fca5a5',
            fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 2
          }}>
            {trend >= 0 ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, margin: '6px 0 2px', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: 0, lineHeight: 1.1 }}>{value}</p>
      {subValue && <p style={{ color: '#64748b', fontSize: 10, margin: '3px 0 0' }}>{subValue}</p>}
    </div>
  );
}

function ProfitBreakdown({ icon, label, revenue, profit, marginPct, color }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}22, ${color}08)`,
      border: `1px solid ${color}44`,
      borderRadius: 12, padding: 14,
    }}>
      <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
      <p style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, margin: '0 0 4px', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ color: '#fff', fontSize: 20, fontWeight: 900, margin: 0 }}>₹{(profit / 100000).toFixed(2)}L</p>
      <p style={{ color: '#64748b', fontSize: 10, margin: '4px 0 0' }}>
        Revenue: ₹{(revenue / 100000).toFixed(2)}L · {marginPct}% margin
      </p>
    </div>
  );
}

function TargetEditor({ target, onSave }) {
  const [editing, setEditing] = useState(false);
  const [sales, setSales] = useState(target.sales);
  const [revenue, setRevenue] = useState(target.revenue);

  const save = () => {
    onSave({ sales: Number(sales), revenue: Number(revenue) });
    setEditing(false);
  };

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>🎯 इस महीने का Target</h3>
        <button onClick={() => editing ? save() : setEditing(true)}
          style={{ background: editing ? '#16a34a' : '#475569', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
          {editing ? '💾 Save' : '✏️ Edit'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Sales (vehicles)</label>
          <input value={sales} disabled={!editing} type="number"
            onChange={(e) => setSales(e.target.value)}
            style={{ background: '#1e293b', color: '#fff', border: '1px solid #475569', borderRadius: 6, padding: '8px 10px', fontSize: 14, width: '100%', outline: 'none', opacity: editing ? 1 : 0.7 }}/>
        </div>
        <div>
          <label style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Revenue (₹)</label>
          <input value={revenue} disabled={!editing} type="number"
            onChange={(e) => setRevenue(e.target.value)}
            style={{ background: '#1e293b', color: '#fff', border: '1px solid #475569', borderRadius: 6, padding: '8px 10px', fontSize: 14, width: '100%', outline: 'none', opacity: editing ? 1 : 0.7 }}/>
        </div>
      </div>
    </div>
  );
}

function ProgressCard({ icon, label, current, target, expectedPace, unit, color, formatValue }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const pacePct = target > 0 ? Math.round((expectedPace / target) * 100) : 0;
  const isAhead = current >= expectedPace;

  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}22, ${color}08)`,
      border: `1px solid ${color}44`,
      borderRadius: 12, padding: 14,
    }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <p style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, margin: '0 0 4px', textTransform: 'uppercase' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ color: '#fff', fontSize: 24, fontWeight: 900 }}>
          {formatValue ? formatValue(current) : current}
        </span>
        <span style={{ color: '#64748b', fontSize: 12 }}>
          / {formatValue ? formatValue(target) : target} {unit}
        </span>
      </div>
      <div style={{ position: 'relative', marginTop: 8, height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
        {/* Expected pace marker */}
        <div style={{
          position: 'absolute', left: `${pacePct}%`, top: 0, bottom: 0,
          width: 2, background: '#fff', opacity: 0.5
        }}/>
        {/* Actual progress */}
        <div style={{ width: `${pct}%`, height: '100%', background: color }}/>
      </div>
      <p style={{ color: isAhead ? '#86efac' : '#fca5a5', fontSize: 11, fontWeight: 600, margin: '6px 0 0' }}>
        {isAhead ? '✅ Ahead of pace' : '⚠️ Behind pace'} · {pct}% achieved
      </p>
    </div>
  );
}