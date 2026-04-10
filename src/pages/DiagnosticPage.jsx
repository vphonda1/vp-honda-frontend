import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, RefreshCw, Clock, Search, Zap, Trash2, Shield, CheckCircle } from 'lucide-react';
import { api } from '../utils/apiConfig';

const getLS = (k, fb={}) => { try { return JSON.parse(localStorage.getItem(k)||'null')||fb; } catch { return fb; } };

export default function DiagnosticPage() {
  const navigate = useNavigate();
  const [customers, setCustomers]   = useState([]);
  const [svcCount, setSvcCount]     = useState(0);
  const [matched, setMatched]       = useState([]);
  const [unmatched, setUnmatched]   = useState([]);
  const [filter, setFilter]         = useState('all');
  const [loading, setLoading]       = useState(true);
  const [refresh, setRefresh]       = useState(new Date());
  const [page, setPage]             = useState(0);
  const [search, setSearch]         = useState('');
  const [msg, setMsg]               = useState('');
  const SIZE = 8;

  useEffect(() => { run(); const fn=()=>run(); window.addEventListener('storage',fn); const t=setInterval(fn,30000); return()=>{window.removeEventListener('storage',fn);clearInterval(t);}; }, []);
  useEffect(() => { setPage(0); }, [filter, search]);

  const run = async () => {
    let db = [];
    try { const r = await fetch(api('/api/customers')); if(r.ok) db = await r.json(); } catch{}
    const ls = [...(JSON.parse(localStorage.getItem('sharedCustomerData')||'[]')), ...(JSON.parse(localStorage.getItem('customerData')||'[]'))];
    const seen = new Set(db.map(c=>c._id));
    ls.forEach(c => { if(!seen.has(c._id)){db.push(c);seen.add(c._id);} });
    setCustomers(db);

    const svc = getLS('customerServiceData', {});
    const inv = [...(JSON.parse(localStorage.getItem('invoices')||'[]')), ...(JSON.parse(localStorage.getItem('generatedInvoices')||'[]'))];
    setSvcCount(Object.keys(svc).length);

    const m=[], u=[];
    Object.entries(svc).forEach(([id, d]) => {
      let c = db.find(x=>x._id===id);
      if(!c && (d.phone)) c = db.find(x=>x.phone===d.phone);
      const i = inv.find(x=>x.customerId===id);
      if(!c && i?.customerPhone) c = db.find(x=>x.phone===i.customerPhone);
      const nm = d.customerName||i?.customerName||'';
      if(!c && nm && !/V.?P.?HONDA|DEALER|Unknown/i.test(nm)) c = db.find(x=>x.name?.toUpperCase()===nm.toUpperCase());

      if(c) {
        m.push({ id, dbId:c._id, name:c.name, phone:c.phone, veh:c.linkedVehicle?.name||i?.vehicle||'', reg:c.linkedVehicle?.regNo||i?.regNo||'', via:c._id===id?'ID':c.phone===(d.phone||i?.customerPhone)?'Phone':'Name', d });
      } else {
        const hasSvc = !!(d.firstServiceDate||d.secondServiceDate||d.thirdServiceDate||d.fourthServiceDate);
        const hasPay = (parseFloat(d.pendingAmount)||0) > 0;
        u.push({ id, name:nm||id.slice(0,15), phone:d.phone||i?.customerPhone||'', veh:d.vehicle||i?.vehicle||'', reg:d.regNo||i?.regNo||'', d, hasSvc, hasPay, useful:hasSvc||hasPay });
      }
    });
    setMatched(m); setUnmatched(u); setRefresh(new Date()); setLoading(false);
  };

  // ── Auto-Fix: delete ALL unmatched that have no service history ──
  const autoFix = () => {
    const empty = unmatched.filter(x=>!x.useful);
    const keep = unmatched.filter(x=>x.useful);
    if(!window.confirm(`🔧 Auto-Fix:\n\n✅ DELETE: ${empty.length} empty entries (no service data)\n⚠️ KEEP: ${keep.length} entries (have service data)\n\nContinue?`)) return;
    const svc = getLS('customerServiceData', {});
    empty.forEach(e => delete svc[e.id]);
    localStorage.setItem('customerServiceData', JSON.stringify(svc));
    window.dispatchEvent(new Event('storage'));
    setMsg(`✅ ${empty.length} empty entries deleted!`);
    setTimeout(()=>setMsg(''),4000); run();
  };

  // ── Delete ALL unmatched (admin) ──
  const deleteAllUnmatched = () => {
    const pwd = prompt('Admin password (Delete All Unmatched):');
    if(pwd !== 'vphonda@123') { alert('❌ Wrong password!'); return; }
    if(!window.confirm(`⚠️ ${unmatched.length} unmatched entries DELETE करें?\n\nयह action undo नहीं होगा!`)) return;
    const svc = getLS('customerServiceData', {});
    unmatched.forEach(e => delete svc[e.id]);
    localStorage.setItem('customerServiceData', JSON.stringify(svc));
    window.dispatchEvent(new Event('storage'));
    setMsg(`✅ ${unmatched.length} entries deleted! System Health improved.`);
    setTimeout(()=>setMsg(''),4000); run();
  };

  // ── Delete single entry ──
  const deleteOne = (entryId) => {
    if(!window.confirm('Delete this entry?')) return;
    const svc = getLS('customerServiceData', {});
    delete svc[entryId];
    localStorage.setItem('customerServiceData', JSON.stringify(svc));
    window.dispatchEvent(new Event('storage'));
    run();
  };

  // ── Display ──
  const getResults = () => {
    let r = filter==='matched' ? matched.map(x=>({...x,_t:'m'}))
      : filter==='unmatched' ? unmatched.map(x=>({...x,_t:'u'}))
      : filter==='db' ? customers.map(c=>({_t:'db',id:c._id,name:c.name,phone:c.phone,veh:c.linkedVehicle?.name||'',reg:c.linkedVehicle?.regNo||''}))
      : [...matched.map(x=>({...x,_t:'m'})), ...unmatched.map(x=>({...x,_t:'u'}))];
    if(search) { const s=search.toLowerCase(); r=r.filter(x=>[x.name,x.phone,x.id,x.veh,x.reg].some(v=>(v||'').toLowerCase().includes(s))); }
    return r;
  };
  const all = getResults();
  const pages = Math.ceil(all.length/SIZE);
  const rows = all.slice(page*SIZE,(page+1)*SIZE);
  const rate = svcCount>0 ? Math.round(matched.length/svcCount*100) : 0;
  const emptyCount = unmatched.filter(x=>!x.useful).length;

  if(loading) return <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center"><div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex justify-between items-center">
          <Button onClick={()=>navigate('/reminders')} className="bg-slate-700 hover:bg-slate-600 text-white h-8 px-3 text-xs"><ArrowLeft size={13} className="mr-1"/>Back</Button>
          <div className="text-center">
            <h1 className="text-lg font-black text-white">🔍 System Diagnostics</h1>
            <p className="text-slate-500 text-[10px]"><Clock size={9} className="inline"/> {refresh.toLocaleTimeString('en-IN')}</p>
          </div>
          <Button onClick={()=>{setLoading(true);run();}} className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3 text-xs"><RefreshCw size={13} className="mr-1"/>Refresh</Button>
        </div>

        {/* Message */}
        {msg && <div className="bg-green-600/20 border border-green-500 text-green-300 rounded-lg px-4 py-2 text-sm font-bold animate-pulse">{msg}</div>}

        {/* Health Score Card */}
        <Card className="bg-gradient-to-r from-slate-800 to-slate-700 border-0 overflow-hidden">
          <CardContent className="p-0">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-slate-400 text-xs font-bold flex items-center gap-1"><Shield size={12}/> System Health</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-4xl font-black ${rate>70?'text-green-400':rate>30?'text-yellow-400':'text-red-400'}`}>{rate}%</span>
                    <span className="text-slate-500 text-xs">({matched.length}/{svcCount} matched)</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button onClick={autoFix} disabled={emptyCount===0} className="bg-orange-600 hover:bg-orange-500 text-white text-[10px] h-7 px-3">
                    <Zap size={11} className="mr-1"/> Auto-Fix ({emptyCount} empty)
                  </Button>
                  <Button onClick={deleteAllUnmatched} disabled={unmatched.length===0} className="bg-red-700 hover:bg-red-600 text-white text-[10px] h-7 px-3">
                    <Trash2 size={11} className="mr-1"/> Delete All ({unmatched.length})
                  </Button>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-2.5 bg-slate-600 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${rate>70?'bg-gradient-to-r from-green-500 to-green-400':rate>30?'bg-gradient-to-r from-yellow-500 to-yellow-400':'bg-gradient-to-r from-red-500 to-red-400'}`} style={{width:`${rate}%`}}/>
              </div>
              <div className="flex justify-between mt-1.5 text-[9px] text-slate-500">
                <span>0%</span>
                <span>{rate > 70 ? '✅ Healthy' : rate > 30 ? '⚠️ Needs attention' : '🚨 Critical — Auto-Fix recommended'}</span>
                <span>100%</span>
              </div>
            </div>
            {/* Quick explanation */}
            {rate < 50 && (
              <div className="bg-red-900/30 px-4 py-2 border-t border-red-800/50 text-[10px] text-red-300">
                💡 <b>Low health = orphaned data.</b> PDF import से customerServiceData में entries बनती हैं जो customer DB से match नहीं होतीं।
                <b> Auto-Fix</b> empty entries delete करता है। <b>Delete All</b> सब unmatched delete करता है (admin password)।
              </div>
            )}
          </CardContent>
        </Card>

        {/* Nav */}
        <div className="grid grid-cols-3 gap-2">
          <Button onClick={()=>navigate('/reminders')} className="bg-orange-600/80 text-white font-bold py-2 text-xs">🔔 Reminders</Button>
          <Button onClick={()=>navigate('/customer-data-manager')} className="bg-purple-600/80 text-white font-bold py-2 text-xs">📊 Data Mgr</Button>
          <Button onClick={()=>navigate('/invoice-management')} className="bg-green-600/80 text-white font-bold py-2 text-xs">📋 Invoices</Button>
        </div>

        {/* Filter Cards */}
        <div className="grid grid-cols-4 gap-2">
          {[
            {v:'all',l:'📊 All',n:svcCount,c:filter==='all'?'ring-2 ring-blue-400 bg-blue-600/30':'bg-blue-900/20 border-blue-800'},
            {v:'matched',l:'✅ Match',n:matched.length,c:filter==='matched'?'ring-2 ring-green-400 bg-green-600/30':'bg-green-900/20 border-green-800'},
            {v:'unmatched',l:'❌ Unmatch',n:unmatched.length,c:filter==='unmatched'?'ring-2 ring-red-400 bg-red-600/30':'bg-red-900/20 border-red-800'},
            {v:'db',l:'👥 DB',n:customers.length,c:filter==='db'?'ring-2 ring-purple-400 bg-purple-600/30':'bg-purple-900/20 border-purple-800'},
          ].map(f=>(
            <div key={f.v} onClick={()=>setFilter(f.v)} className={`p-2.5 rounded-xl border cursor-pointer transition-all ${f.c}`}>
              <p className="text-slate-400 text-[9px] font-bold">{f.l}</p>
              <p className="text-white font-black text-xl mt-0.5">{f.n}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search..."
          className="bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 h-8 text-xs"/>

        {/* Results */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <p className="text-slate-600 text-[10px]">{all.length} results · Page {page+1}/{pages||1}</p>
            {filter!=='all' && <button onClick={()=>setFilter('all')} className="text-[10px] text-blue-400">Clear</button>}
          </div>

          {rows.length===0 ? (
            <div className="text-center py-12"><CheckCircle size={36} className="text-green-500 mx-auto mb-2"/><p className="text-slate-400 text-sm">All clean!</p></div>
          ) : rows.map((r,i) => (
            <div key={i} className={`rounded-lg p-3 border transition-all ${
              r._t==='m' ? 'bg-green-900/15 border-green-800/50 hover:border-green-600'
              : r._t==='u' ? 'bg-red-900/15 border-red-800/50 hover:border-red-600'
              : 'bg-purple-900/15 border-purple-800/50 hover:border-purple-600'
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-lg">{r._t==='m'?'✅':r._t==='u'?'❌':'👤'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-bold text-sm truncate">{r.name||'Unknown'}</span>
                    {r._t==='m' && <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${r.via==='ID'?'bg-green-800 text-green-300':r.via==='Phone'?'bg-blue-800 text-blue-300':'bg-yellow-800 text-yellow-300'}`}>{r.via}</span>}
                    {r._t==='u' && r.useful && <span className="text-[8px] bg-yellow-800 text-yellow-300 px-1.5 py-0.5 rounded-full font-bold">Has Data</span>}
                    {r._t==='u' && !r.useful && <span className="text-[8px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full">Empty</span>}
                  </div>
                  <div className="flex gap-2 mt-0.5 text-[10px] text-slate-500 flex-wrap">
                    {r.phone && <span>📞 {r.phone}</span>}
                    {r.veh && <span>🏍️ {r.veh}</span>}
                    {r.reg && <span className="font-mono">{r.reg}</span>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {r._t!=='u' && (
                    <button onClick={()=>navigate(`/customer-profile/${r.dbId||r.id}`)} className="bg-blue-600 hover:bg-blue-500 text-white text-[9px] px-2 py-1 rounded font-bold">View</button>
                  )}
                  {r._t==='u' && (
                    <button onClick={()=>deleteOne(r.id)} className="bg-red-700 hover:bg-red-600 text-white text-[9px] px-2 py-1 rounded font-bold">🗑 Delete</button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {pages>1 && (
            <div className="flex items-center justify-between pt-2">
              <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} className="bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded disabled:opacity-30 font-bold">◀</button>
              <div className="flex gap-1">
                {Array.from({length:Math.min(7,pages)}).map((_,i)=>{
                  const pg=Math.max(0,Math.min(pages-7,page-3))+i;
                  if(pg>=pages) return null;
                  return <button key={pg} onClick={()=>setPage(pg)} className={`w-6 h-6 rounded text-[9px] font-bold ${pg===page?'bg-blue-600 text-white':'bg-slate-800 text-slate-400'}`}>{pg+1}</button>;
                })}
              </div>
              <button onClick={()=>setPage(p=>Math.min(pages-1,p+1))} disabled={page>=pages-1} className="bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded disabled:opacity-30 font-bold">▶</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
