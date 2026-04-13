import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { RefreshCw, Clock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../utils/apiConfig';

const getLS = (k, fb=[]) => { try { return JSON.parse(localStorage.getItem(k)||'null')||fb; } catch{ return fb; } };
const COLORS = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316'];
const fmtINR = (n) => '₹'+(n||0).toLocaleString('en-IN');

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [s, setS] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => { loadAll(); const t=setInterval(loadAll,30000); const fn=()=>loadAll(); window.addEventListener('storage',fn); return()=>{clearInterval(t);window.removeEventListener('storage',fn);}; }, []);

  const loadAll = async () => {
    // MongoDB PRIMARY — always fetch fresh
    const doFetch = async (url, lsKey, fb=[]) => {
      try { const r=await fetch(api(url)); if(r.ok){const d=await r.json(); if(d&&(Array.isArray(d)?d.length>0:true)){if(lsKey)localStorage.setItem(lsKey,JSON.stringify(d)); return d;}} } catch{}
      return getLS(lsKey, fb);
    };
    const [apiC, apiP, apiI] = await Promise.all([
      doFetch('/api/customers','sharedCustomerData'),
      doFetch('/api/parts','partsInventory'),
      doFetch('/api/invoices','invoices'),
    ]);
    const apiOld = await doFetch('/api/oldbikes','oldBikeData');
    const apiStaff = await doFetch('/api/staff','staffData');
    const lsInv=apiI, genInv=getLS('generatedInvoices'), veh=apiC.length>0?apiC:getLS('vehDashboardData'), old=apiOld, svc=getLS('customerServiceData',{}), staff=apiStaff, quot=await doFetch('/api/quotations','quotations'), lsC=apiC, lsP=apiP;
    const allInv=[...lsInv,...genInv];
    const totalC=Math.max(apiC.length,lsC.length), totalP=Math.max(apiP.length,lsP.length), totalI=allInv.length, totalV=veh.length;
    const lsRev=allInv.reduce((a,i)=>a+(i.totals?.totalAmount||i.amount||0),0);
    const vehRev=veh.reduce((a,v)=>a+(parseFloat(v.price)||0),0);
    const apiRev=apiI.reduce((a,i)=>a+(i.total||0),0);
    const svcE=Object.values(svc), pendSvc=svcE.filter(x=>!x.firstServiceDate||!x.secondServiceDate).length;
    const finalOld = old.length > 0 ? old : apiOld; const finalStaff = staff.length > 0 ? staff : apiStaff;

    const vm={}; veh.forEach(v=>{const m=(v.vehicleModel||v.model||'?').split(' ').slice(0,2).join(' '); vm[m]=(vm[m]||0)+1;});
    const vChart=Object.entries(vm).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,value])=>({name,value}));
    const mm={}; allInv.forEach(i=>{const d=i.invoiceDate||i.date; if(d){const m=String(d).slice(0,7); mm[m]=(mm[m]||0)+1;}});
    const mChart=Object.entries(mm).sort().slice(-6).map(([name,value])=>({name:name.slice(5),value}));
    const svcInv=allInv.filter(i=>i.invoiceType==='service'||(i.totals?.totalAmount||0)<50000).length;
    const recent=[...allInv].sort((a,b)=>new Date(b.importedAt||b.invoiceDate||0)-new Date(a.importedAt||a.invoiceDate||0)).slice(0,5);

    setS({totalC,totalP,totalI,totalV,rev:lsRev+apiRev+vehRev,vehRev,svcRev:lsRev,old:finalOld.length,staff:finalStaff.length,quot:quot.length,pendSvc,svcInv,vehInv:allInv.length-svcInv,vChart,mChart,recent,svcEntries:Object.keys(svc).length});
    setLastRefresh(new Date()); setLoading(false);
  };

  if(loading||!s) return <div className="max-w-7xl mx-auto p-6 text-center py-20"><div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"/><p className="text-gray-500">Loading...</p></div>;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Welcome, {user?.name}! 👋</h1>
          <p className="text-gray-500 text-sm flex items-center gap-1 mt-1"><Clock size={12}/> {lastRefresh.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})} {user?.role==='admin'&&' · Admin'}</p>
        </div>
        <Button onClick={loadAll} className="bg-blue-600 hover:bg-blue-700 text-white"><RefreshCw size={16} className="mr-1"/> Refresh</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[{t:'Customers',v:s.totalC,i:'👥',c:'text-blue-700',bg:'bg-blue-50',l:'/customers'},{t:'Vehicles Sold',v:s.totalV,i:'🏍️',c:'text-green-700',bg:'bg-green-50',l:'/veh-dashboard'},{t:'Invoices',v:s.totalI,i:'📄',c:'text-orange-700',bg:'bg-orange-50',l:'/invoice-management'},{t:'Parts',v:s.totalP,i:'📦',c:'text-purple-700',bg:'bg-purple-50',l:'/parts'}].map((k,i)=>(
          <Card key={i} className={`${k.bg} border-2 hover:shadow-md cursor-pointer transition`} onClick={()=>navigate(k.l)}>
            <CardContent className="p-4"><p className="text-gray-500 text-xs font-bold">{k.i} {k.t}</p><p className={`${k.c} font-black text-3xl mt-1`}>{k.v}</p></CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue + Reminders + Old Bikes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300">
          <CardContent className="p-4"><p className="text-green-600 text-sm font-bold">💰 Total Revenue</p><p className="text-green-800 font-black text-2xl mt-1">{fmtINR(s.rev)}</p><p className="text-green-500 text-xs mt-1">Vehicle: {fmtINR(s.vehRev)} | Service: {fmtINR(s.svcRev)}</p></CardContent>
        </Card>
        <Card className="bg-red-50 border-2 border-red-300 cursor-pointer" onClick={()=>navigate('/reminders')}>
          <CardContent className="p-4"><p className="text-red-600 text-sm font-bold">🔔 Service Reminders</p><p className="text-red-800 font-black text-2xl mt-1">{s.pendSvc}</p><p className="text-red-400 text-xs mt-1">Pending service customers</p></CardContent>
        </Card>
        <Card className="bg-yellow-50 border-2 border-yellow-300 cursor-pointer" onClick={()=>navigate('/veh-dashboard')}>
          <CardContent className="p-4"><p className="text-yellow-600 text-sm font-bold">🚲 Old Bikes: {s.old} | Staff: {s.staff}</p><p className="text-yellow-800 font-black text-2xl mt-1">Quotations: {s.quot}</p></CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-2">
          <CardHeader className="py-3 bg-blue-50"><CardTitle className="text-sm">🏍️ Vehicle Models — Sales</CardTitle></CardHeader>
          <CardContent>{s.vChart.length>0?<ResponsiveContainer width="100%" height={220}><PieChart><Pie data={s.vChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({name,value})=>`${name}: ${value}`}>{s.vChart.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>:<p className="text-gray-400 text-center py-10">Vehicle data load करें</p>}</CardContent>
        </Card>
        <Card className="border-2">
          <CardHeader className="py-3 bg-green-50"><CardTitle className="text-sm">📈 Monthly Invoices</CardTitle></CardHeader>
          <CardContent>{s.mChart.length>0?<ResponsiveContainer width="100%" height={220}><BarChart data={s.mChart}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/><Tooltip/><Bar dataKey="value" fill="#10b981" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>:<p className="text-gray-400 text-center py-10">Invoice data load करें</p>}</CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <Card className="border-2">
        <CardHeader className="py-3 bg-purple-50"><CardTitle className="text-sm">⚡ All Pages</CardTitle></CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[{l:'🏍️ Veh Dashboard',p:'/veh-dashboard',a:true},{l:'📄 Invoice Mgmt',p:'/invoice-management',a:true},{l:'👥 Customers',p:'/customers'},{l:'📦 Parts',p:'/parts'},{l:'🔔 Reminders',p:'/reminders'},{l:'🎫 Job Cards',p:'/job-cards'},{l:'📊 Reports',p:'/reports',a:true},{l:'📋 Quotation',p:'/quotation'},{l:'👥 Staff',p:'/staff-management'},{l:'📊 Data Mgmt',p:'/data-management',a:true},{l:'⚙️ Admin',p:'/admin',a:true},{l:'📋 VP Dashboard',p:'/vph-dashboard',a:true}].filter(x=>!x.a||user?.role==='admin').map((x,i)=>(
              <Link key={i} to={x.p} className="block bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 rounded-lg p-3 text-center font-bold text-sm transition hover:border-purple-400">{x.l}</Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Invoices */}
      <Card className="border-2">
        <CardHeader className="py-3 bg-gradient-to-r from-purple-600 to-pink-600"><div className="flex justify-between items-center"><CardTitle className="text-white text-sm">📄 Recent Invoices</CardTitle><Link to="/invoice-management" className="text-white text-xs hover:underline">सभी देखें →</Link></div></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b-2"><tr>{['#','Invoice','Customer','Vehicle','Amount','Date'].map(h=><th key={h} className="px-4 py-2.5 text-left font-bold">{h}</th>)}</tr></thead>
            <tbody>
              {(s.recent||[]).length===0?<tr><td colSpan="6" className="px-6 py-6 text-center text-gray-400">PDF import करें → Invoice Management</td></tr>
              :s.recent.map((inv,i)=>(
                <tr key={i} className="border-b hover:bg-gray-50 cursor-pointer" onClick={()=>navigate(`/invoice/${inv.invoiceNumber||inv.id}`)}>
                  <td className="px-4 py-2.5 text-gray-400">{i+1}</td>
                  <td className="px-4 py-2.5 font-bold text-blue-700">#{inv.invoiceNumber||inv.id}</td>
                  <td className="px-4 py-2.5">{inv.customerName||'—'}</td>
                  <td className="px-4 py-2.5 text-blue-500">{inv.vehicle||'—'}</td>
                  <td className="px-4 py-2.5 font-bold text-green-600">{fmtINR(inv.totals?.totalAmount||inv.amount||0)}</td>
                  <td className="px-4 py-2.5 text-gray-400">{inv.invoiceDate?new Date(inv.invoiceDate).toLocaleDateString('en-IN'):'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Invoice Split */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-orange-50 border-2 cursor-pointer" onClick={()=>navigate('/invoice-management')}><CardContent className="p-4 text-center"><p className="text-orange-600 text-xs font-bold">🏍️ Vehicle Invoices</p><p className="text-orange-800 font-black text-2xl">{s.vehInv}</p></CardContent></Card>
        <Card className="bg-green-50 border-2 cursor-pointer" onClick={()=>navigate('/invoice-management')}><CardContent className="p-4 text-center"><p className="text-green-600 text-xs font-bold">🔧 Service Invoices</p><p className="text-green-800 font-black text-2xl">{s.svcInv}</p></CardContent></Card>
      </div>
    </div>
  );
}