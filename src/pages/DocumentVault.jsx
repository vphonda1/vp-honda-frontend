// DocumentVault.jsx — VP Honda Document Storage
import { useState } from 'react';
import { FolderOpen, Camera, X, AlertTriangle, Search } from 'lucide-react';
import { captureFromCamera, checkExpiry, showInAppToast } from '../utils/smartUtils';

const DOC_TYPES = [
  {key:'aadhar',    label:'Aadhar Card',    icon:'🪪', hasExpiry:false},
  {key:'pan',       label:'PAN Card',        icon:'💳', hasExpiry:false},
  {key:'rc',        label:'RC (Registration Certificate)', icon:'📄', hasExpiry:false},
  {key:'insurance', label:'Insurance',       icon:'🛡️', hasExpiry:true},
  {key:'puc',       label:'PUC Certificate', icon:'🔬', hasExpiry:true},
  {key:'dl',        label:"Driver's License",icon:'🪪', hasExpiry:true},
  {key:'other',     label:'Other Document',  icon:'📁', hasExpiry:false},
];

const loadDocs = () => JSON.parse(localStorage.getItem('vp_documents')||'[]');
const saveDocs = (d) => localStorage.setItem('vp_documents', JSON.stringify(d));

export default function DocumentVault() {
  const [docs, setDocs] = useState(loadDocs());
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({customerName:'', customerPhone:'', docType:'aadhar', expiryDate:'', notes:''});
  const [photo, setPhoto] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [viewDoc, setViewDoc] = useState(null);

  const capturePhoto = async () => {
    setCapturing(true);
    try {
      const img = await captureFromCamera('environment');
      setPhoto(img);
      showInAppToast('📷 Photo captured','','success');
    } catch(e) {
      alert('Camera error: '+e);
    }
    setCapturing(false);
  };

  const saveDoc = () => {
    if(!form.customerName||!photo){alert('Customer name और photo जरूरी है');return;}
    const docType = DOC_TYPES.find(d=>d.key===form.docType)||DOC_TYPES[0];
    const d = {
      id:`doc_${Date.now()}`,
      ...form,
      docTypeLabel: docType.label,
      docIcon: docType.icon,
      photo,
      fileSize: Math.round(photo.length * 0.75 / 1024) + ' KB',
      savedAt: new Date().toISOString(),
    };
    const updated=[d,...docs]; saveDocs(updated); setDocs(updated);
    setShowForm(false); setPhoto(null);
    setForm({customerName:'',customerPhone:'',docType:'aadhar',expiryDate:'',notes:''});
    showInAppToast('📂 Document saved','','success');
  };

  const deleteDoc = (id) => {
    if(!window.confirm('Delete this document?'))return;
    const u=docs.filter(d=>d.id!==id); saveDocs(u); setDocs(u);
  };

  // Search
  const filtered = docs.filter(d =>
    !search || d.customerName.toLowerCase().includes(search.toLowerCase()) ||
    (d.customerPhone||'').includes(search) || d.docTypeLabel.toLowerCase().includes(search.toLowerCase())
  );

  // Expiry alerts
  const expiringSoon = docs.filter(d => {
    if(!d.expiryDate) return false;
    const check = checkExpiry(d.expiryDate, d.docTypeLabel);
    return check && check.status !== 'ok';
  });

  return (
    <div style={{padding:14, background:'#020617', minHeight:'100vh', color:'#fff'}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:800,margin:0,display:'flex',alignItems:'center',gap:8}}>
            <FolderOpen size={20}/> Document Vault
          </h1>
          <p style={{color:'#94a3b8',fontSize:12,margin:'4px 0 0'}}>Aadhar, PAN, RC, Insurance — सब safe रखें</p>
        </div>
        <button onClick={()=>setShowForm(true)} style={{background:'linear-gradient(135deg,#DC0000,#B91C1C)',color:'#fff',border:'none',padding:'10px 16px',borderRadius:10,fontWeight:700,fontSize:13,cursor:'pointer'}}>
          📷 Add Document
        </button>
      </div>

      {/* Expiry Alerts */}
      {expiringSoon.length>0&&(
        <div style={{background:'#7c2d1222',border:'1px solid #ea580c',borderRadius:10,padding:'10px 14px',marginBottom:12}}>
          <p style={{color:'#fdba74',fontWeight:700,fontSize:13,margin:'0 0 6px',display:'flex',alignItems:'center',gap:6}}>
            <AlertTriangle size={14}/> {expiringSoon.length} Documents Expire Soon!
          </p>
          {expiringSoon.map((d,i)=>{
            const check=checkExpiry(d.expiryDate,d.docTypeLabel);
            return (
              <p key={i} style={{color:'#fed7aa',fontSize:12,margin:'4px 0 0'}}>
                {d.docIcon} {d.customerName} · {d.docTypeLabel} · {check?.msg}
              </p>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div style={{position:'relative',marginBottom:12}}>
        <Search size={14} style={{position:'absolute',left:12,top:11,color:'#64748b'}}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Customer name, phone, या document type..."
          style={{background:'#1e293b',color:'#fff',border:'1px solid #475569',borderRadius:8,padding:'10px 12px 10px 34px',fontSize:13,width:'100%',outline:'none'}}/>
      </div>

      {/* Stats Row */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:8,marginBottom:14}}>
        {DOC_TYPES.map(t=>{
          const count=docs.filter(d=>d.docType===t.key).length;
          if(!count) return null;
          return (
            <div key={t.key} style={{background:'#0f172a',border:'1px solid #1e293b',borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
              <div style={{fontSize:18}}>{t.icon}</div>
              <p style={{color:'#fff',fontSize:16,fontWeight:800,margin:'4px 0 2px'}}>{count}</p>
              <p style={{color:'#64748b',fontSize:9,margin:0,textTransform:'uppercase',fontWeight:700,lineHeight:1.2}}>{t.label}</p>
            </div>
          );
        }).filter(Boolean)}
      </div>

      {/* Document Grid */}
      {filtered.length===0
        ? <div style={{background:'#0f172a',border:'1px solid #1e293b',borderRadius:12,padding:40,textAlign:'center',color:'#64748b'}}>
            {search ? `"${search}" के लिए कोई document नहीं` : 'कोई document नहीं। ऊपर "📷 Add Document" दबाएं।'}
          </div>
        : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:10}}>
            {filtered.map(d=>(
              <div key={d.id} style={{background:'#0f172a',border:'1px solid #1e293b',borderRadius:12,overflow:'hidden'}}>
                {/* Photo Thumbnail */}
                <div onClick={()=>setViewDoc(d)} style={{cursor:'pointer',position:'relative',height:140,overflow:'hidden',background:'#1e293b'}}>
                  <img src={d.photo} alt={d.docTypeLabel} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  <div style={{position:'absolute',top:8,left:8,background:'rgba(0,0,0,0.7)',padding:'3px 8px',borderRadius:4,fontSize:11,fontWeight:700}}>
                    {d.docIcon} {d.docTypeLabel}
                  </div>
                  <div style={{position:'absolute',bottom:8,right:8,background:'rgba(0,0,0,0.7)',padding:'2px 6px',borderRadius:3,fontSize:10,color:'#94a3b8'}}>
                    {d.fileSize}
                  </div>
                </div>
                {/* Info */}
                <div style={{padding:'10px 12px'}}>
                  <p style={{fontWeight:700,fontSize:13,margin:'0 0 4px'}}>{d.customerName}</p>
                  <p style={{color:'#94a3b8',fontSize:11,margin:0}}>
                    {d.customerPhone&&`📞 ${d.customerPhone} · `}
                    📅 {new Date(d.savedAt).toLocaleDateString('en-IN')}
                  </p>
                  {d.expiryDate&&(()=>{
                    const check=checkExpiry(d.expiryDate,d.docTypeLabel);
                    return <p style={{color:check?.status==='expired'?'#fca5a5':check?.status==='expiring'?'#fdba74':'#86efac',fontSize:11,margin:'4px 0 0',fontWeight:600}}>
                      {check?.status==='expired'?'🚨':check?.status==='expiring'?'⚠️':'✅'} {check?.msg}
                    </p>;
                  })()}
                  {d.notes&&<p style={{color:'#cbd5e1',fontSize:11,fontStyle:'italic',margin:'4px 0 0'}}>"{d.notes}"</p>}
                  <div style={{display:'flex',gap:6,marginTop:8}}>
                    <button onClick={()=>setViewDoc(d)} style={{flex:1,background:'#1e40af',color:'#fff',border:'none',padding:'6px',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer'}}>👁️ View</button>
                    <button onClick={()=>deleteDoc(d.id)} style={{background:'#7f1d1d',color:'#fff',border:'none',padding:'6px 10px',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer'}}>🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
      }

      {/* View Full Image Modal */}
      {viewDoc&&(
        <div onClick={()=>setViewDoc(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#0f172a',borderRadius:14,overflow:'hidden',maxWidth:600,width:'100%',maxHeight:'90vh',display:'flex',flexDirection:'column'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:'1px solid #1e293b'}}>
              <div>
                <p style={{fontWeight:800,fontSize:14,margin:0}}>{viewDoc.docIcon} {viewDoc.docTypeLabel}</p>
                <p style={{color:'#94a3b8',fontSize:11,margin:'2px 0 0'}}>{viewDoc.customerName} · {viewDoc.customerPhone}</p>
              </div>
              <div style={{display:'flex',gap:6}}>
                <button onClick={()=>{const a=document.createElement('a');a.href=viewDoc.photo;a.download=`${viewDoc.customerName}_${viewDoc.docType}.jpg`;a.click();}}
                  style={{background:'#16a34a',color:'#fff',border:'none',padding:'6px 10px',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer'}}>⬇️ Save</button>
                <button onClick={()=>setViewDoc(null)} style={{background:'#475569',color:'#fff',border:'none',padding:'6px 10px',borderRadius:6,cursor:'pointer'}}><X size={16}/></button>
              </div>
            </div>
            <div style={{flex:1,overflow:'auto',padding:0}}>
              <img src={viewDoc.photo} alt={viewDoc.docTypeLabel} style={{width:'100%',height:'auto',display:'block'}}/>
            </div>
          </div>
        </div>
      )}

      {/* Add Document Modal */}
      {showForm&&(
        <div onClick={()=>{setShowForm(false);setPhoto(null);}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,zIndex:50}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#0f172a',border:'1px solid #334155',borderRadius:14,width:'100%',maxWidth:480,padding:20,maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
              <h2 style={{fontSize:16,fontWeight:800,margin:0}}>📷 Add Document</h2>
              <button onClick={()=>{setShowForm(false);setPhoto(null);}} style={{background:'none',border:'none',color:'#94a3b8',cursor:'pointer'}}><X size={18}/></button>
            </div>
            <div style={{display:'grid',gap:10}}>
              {[
                {l:'Customer Name *',k:'customerName'},
                {l:'Phone',k:'customerPhone',max:10},
                {l:'Notes',k:'notes',ph:'Optional'},
              ].map(({l,k,ph,max})=>(
                <div key={k}>
                  <label style={{color:'#94a3b8',fontSize:11,fontWeight:700,marginBottom:4,display:'block'}}>{l}</label>
                  <input value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} placeholder={ph||''}
                    maxLength={max} style={{background:'#1e293b',color:'#fff',border:'1px solid #475569',borderRadius:8,padding:'10px 12px',fontSize:13,width:'100%',outline:'none'}}/>
                </div>
              ))}
              <div>
                <label style={{color:'#94a3b8',fontSize:11,fontWeight:700,marginBottom:4,display:'block'}}>Document Type *</label>
                <select value={form.docType} onChange={e=>setForm({...form,docType:e.target.value})} style={{background:'#1e293b',color:'#fff',border:'1px solid #475569',borderRadius:8,padding:'10px 12px',fontSize:13,width:'100%',outline:'none'}}>
                  {DOC_TYPES.map(t=><option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
                </select>
              </div>
              {DOC_TYPES.find(t=>t.key===form.docType)?.hasExpiry&&(
                <div>
                  <label style={{color:'#94a3b8',fontSize:11,fontWeight:700,marginBottom:4,display:'block'}}>Expiry Date</label>
                  <input type="date" value={form.expiryDate} onChange={e=>setForm({...form,expiryDate:e.target.value})}
                    style={{background:'#1e293b',color:'#fff',border:'1px solid #475569',borderRadius:8,padding:'10px 12px',fontSize:13,width:'100%',outline:'none'}}/>
                </div>
              )}

              {/* Camera */}
              <div>
                <label style={{color:'#94a3b8',fontSize:11,fontWeight:700,marginBottom:6,display:'block'}}>📷 Document Photo *</label>
                {photo ? (
                  <div style={{position:'relative'}}>
                    <img src={photo} alt="preview" style={{width:'100%',borderRadius:8,border:'1px solid #16a34a',maxHeight:200,objectFit:'cover'}}/>
                    <button onClick={()=>setPhoto(null)} style={{position:'absolute',top:6,right:6,background:'#dc2626',color:'#fff',border:'none',borderRadius:'50%',width:26,height:26,cursor:'pointer',fontWeight:700}}>×</button>
                    <p style={{color:'#86efac',fontSize:11,margin:'4px 0 0',textAlign:'center'}}>✅ Photo ready</p>
                  </div>
                ) : (
                  <button onClick={capturePhoto} disabled={capturing}
                    style={{width:'100%',background:'#1e3a8a',color:'#fff',border:'2px dashed #3b82f6',borderRadius:8,padding:'20px',fontSize:13,fontWeight:700,cursor:'pointer',textAlign:'center'}}>
                    {capturing ? '⏳ Opening camera...' : '📷 Take Photo (Camera)'}
                    <p style={{color:'#94a3b8',fontSize:11,margin:'6px 0 0',fontWeight:400}}>Back camera से document की clear photo लें</p>
                  </button>
                )}
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:14}}>
              <button onClick={saveDoc} disabled={!photo} style={{flex:1,background:photo?'#DC0000':'#475569',color:'#fff',border:'none',padding:12,borderRadius:10,fontWeight:800,cursor:photo?'pointer':'not-allowed'}}>💾 Save Document</button>
              <button onClick={()=>{setShowForm(false);setPhoto(null);}} style={{background:'#475569',color:'#fff',border:'none',padding:'12px 16px',borderRadius:10,fontWeight:700,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
