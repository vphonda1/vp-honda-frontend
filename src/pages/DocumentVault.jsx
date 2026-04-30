// DocumentVault.jsx — VP Honda Document Vault (Complete)
// Enhanced: Customer search dropdown + multi-document batch upload
// Features:
// • Camera + Gallery photo upload
// • Customer-wise folders (date-wise)
// • Aadhar no., Customer name, Mobile no. fields
// • Insurance button → WhatsApp group (Aadhar, PAN, Chassis trace, Hypothecation, Nominee)
// • RTO button → WhatsApp to Pal (Aadhar, PAN, Chassis trace, Tax Invoice, Chassis photo)
// • Expiry alerts
// • NEW: Searchable customer dropdown (type ≥2 chars → select from list)
// • NEW: Stay‑open modal to add multiple docs for same customer

import { useState, useEffect, useRef } from 'react';
import { FolderOpen, Camera, X, AlertTriangle, Search, Image, ChevronRight } from 'lucide-react';
import { captureFromCamera, checkExpiry, showInAppToast, sendWhatsApp } from '../utils/smartUtils';
import { api } from '../utils/apiConfig';

// ── Document types ────────────────────────────────────────────────────────────
const DOC_TYPES = [
  { key:'aadhar',       label:'Aadhar Card',          icon:'🪪', hasExpiry:false },
  { key:'pan',          label:'PAN Card',              icon:'💳', hasExpiry:false },
  { key:'chassis_trace',label:'Chassis Trace Page',   icon:'📋', hasExpiry:false },
  { key:'tax_invoice',  label:'Tax Invoice',           icon:'🧾', hasExpiry:false },
  { key:'hypothecation',label:'Hypothecation Letter', icon:'🏦', hasExpiry:false },
  { key:'nominee',      label:'Nominee Form',          icon:'👤', hasExpiry:false },
  { key:'chassis_photo',label:'Chassis Photo',         icon:'🔢', hasExpiry:false },
  { key:'rto_form',     label:'RTO Form',              icon:'🚗', hasExpiry:false },
  { key:'rc',           label:'RC Book',               icon:'📄', hasExpiry:false },
  { key:'insurance',    label:'Insurance Policy',      icon:'🛡️', hasExpiry:true  },
  { key:'puc',          label:'PUC Certificate',       icon:'🔬', hasExpiry:true  },
  { key:'other',        label:'Other Document',        icon:'📁', hasExpiry:false },
];

// ── Insurance & RTO required doc keys ─────────────────────────────────────────
const INS_DOCS   = ['aadhar','pan','chassis_trace','hypothecation','nominee'];
const RTO_DOCS   = ['aadhar','pan','chassis_trace','tax_invoice','chassis_photo'];

const loadDocs = () => {
  try { return JSON.parse(localStorage.getItem('vp_documents') || '[]'); } catch { return []; }
};
const saveDocs = (d) => localStorage.setItem('vp_documents', JSON.stringify(d));

// ── Customer folder key ────────────────────────────────────────────────────────
const folderKey = (name, date) => {
  const d = date ? new Date(date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'}) : new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'});
  return `${(name || 'Unknown').replace(/\s+/g,'_')}_${d}`;
};

export default function DocumentVault() {
  const [docs,        setDocs]        = useState(loadDocs());
  const [search,      setSearch]      = useState('');
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState({ customerName:'', customerPhone:'', aadharNo:'', vehicleModel:'', chassisNo:'', docType:'aadhar', expiryDate:'', notes:'' });
  const [photo,       setPhoto]       = useState(null);
  const [capturing,   setCapturing]   = useState(false);
  const [viewDoc,     setViewDoc]     = useState(null);
  const [activeFolder,setActiveFolder]= useState(null);
  const [view,        setView]        = useState('folders'); // 'folders' | 'all'
  const [customers,   setCustomers]   = useState([]);

  // Customer search dropdown state
  const [custSearch, setCustSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Load customers for autofill
  useEffect(() => {
    fetch(api('/api/customers')).then(r => r.ok ? r.json() : []).then(setCustomers).catch(() => {});
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter customers based on search text (name, phone, aadhar)
  const filteredCustomers = custSearch.trim().length >= 2
    ? customers.filter(c =>
        (c.customerName || c.name || '').toLowerCase().includes(custSearch.toLowerCase()) ||
        (c.mobileNo || c.phone || '').includes(custSearch) ||
        (c.aadhar || '').includes(custSearch)
      ).slice(0, 8)
    : [];

  // Select a customer from dropdown
  const selectCustomer = (cust) => {
    setForm({
      ...form,
      customerName: cust.customerName || cust.name || '',
      customerPhone: cust.mobileNo || cust.phone || '',
      aadharNo: cust.aadhar || '',
      vehicleModel: cust.vehicleModel || '',
      chassisNo: cust.chassisNo || '',
    });
    setCustSearch(cust.customerName || cust.name || '');
    setShowDropdown(false);
  };

  // Handle manual typing in customer name field
  const handleCustNameChange = (value) => {
    setCustSearch(value);
    setForm({ ...form, customerName: value });
    setShowDropdown(value.trim().length >= 2);
  };

  // ── Photo: Camera ────────────────────────────────────────────────────────────
  const capturePhoto = async () => {
    setCapturing(true);
    try {
      const img = await captureFromCamera('environment');
      setPhoto(img);
      showInAppToast('📷 Photo captured','','success');
    } catch(e) {
      showInAppToast('❌ Camera error', String(e), 'error');
    }
    setCapturing(false);
  };

  // ── Photo: Gallery ────────────────────────────────────────────────────────────
  const pickFromGallery = () => {
    const input = document.createElement('input');
    input.type  = 'file';
    input.accept= 'image/*';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setPhoto(reader.result);
      reader.readAsDataURL(file);
      showInAppToast('🖼️ Photo selected','','success');
    };
    input.click();
  };

  // ── Save document (with option to stay open for batch upload) ────────────────
  const saveDoc = (stayOpen = false) => {
    if (!form.customerName || !photo) {
      alert('Customer name और photo जरूरी है');
      return;
    }
    const docType = DOC_TYPES.find(d => d.key === form.docType) || DOC_TYPES[0];
    const now     = new Date().toISOString();
    const d = {
      id:           `doc_${Date.now()}`,
      folder:       folderKey(form.customerName, now),
      customerName: form.customerName,
      customerPhone:form.customerPhone,
      aadharNo:     form.aadharNo,
      vehicleModel: form.vehicleModel,
      chassisNo:    form.chassisNo,
      docType:      form.docType,
      docTypeLabel: docType.label,
      docIcon:      docType.icon,
      expiryDate:   form.expiryDate,
      notes:        form.notes,
      photo,
      fileSize:     Math.round(photo.length * 0.75 / 1024) + ' KB',
      savedAt:      now,
    };
    const updated = [d, ...docs];
    saveDocs(updated);
    setDocs(updated);
    showInAppToast('📂 Document saved', d.docTypeLabel, 'success');

    if (!stayOpen) {
      // Close modal and reset everything
      setShowForm(false);
      setPhoto(null);
      setForm({ customerName:'', customerPhone:'', aadharNo:'', vehicleModel:'', chassisNo:'', docType:'aadhar', expiryDate:'', notes:'' });
      setCustSearch('');
    } else {
      // Stay open: clear photo, doc type, expiry, notes — keep customer data
      setPhoto(null);
      setForm({
        ...form,
        docType: 'aadhar',
        expiryDate: '',
        notes: '',
      });
      // Keep customer name, phone, aadhar, vehicle, chassis unchanged
      // Also keep custSearch in sync
      setCustSearch(form.customerName);
    }
  };

  const deleteDoc = (id) => {
    if (!window.confirm('Delete?')) return;
    const u = docs.filter(d => d.id !== id);
    saveDocs(u); setDocs(u);
  };

  // ── Customer folders (group by folder key) ────────────────────────────────────
  const folders = docs.reduce((acc, d) => {
    const key = d.folder || folderKey(d.customerName, d.savedAt);
    if (!acc[key]) acc[key] = { name: d.customerName, phone: d.customerPhone, docs: [], date: d.savedAt };
    acc[key].docs.push(d);
    return acc;
  }, {});
  const folderList = Object.entries(folders).sort((a,b) => new Date(b[1].date) - new Date(a[1].date));

  // ── Insurance WhatsApp ────────────────────────────────────────────────────────
  const sendInsurance = (folderDocs, customerName, customerPhone) => {
    const available = INS_DOCS.filter(t => folderDocs.some(d => d.docType === t));
    const missing   = INS_DOCS.filter(t => !folderDocs.some(d => d.docType === t));

    if (available.length === 0) {
      alert(`❌ Insurance के लिए कोई document नहीं है.\n\nजरूरी documents:\n${INS_DOCS.map(t => DOC_TYPES.find(d=>d.key===t)?.label || t).join('\n')}`);
      return;
    }

    const phone = prompt(
      `🛡️ Insurance Documents WhatsApp करें\n\nAvailable: ${available.length}/${INS_DOCS.length} documents\n${missing.length>0?`Missing: ${missing.map(t=>DOC_TYPES.find(d=>d.key===t)?.label||t).join(', ')}\n`:''}\nInsurance Company का WhatsApp number डालें:`
    );
    if (!phone) return;

    const msg = `🛡️ *VP Honda — Insurance Documents*\n\n👤 Customer: ${customerName}\n📞 ${customerPhone || '-'}\n\nDocuments:\n${available.map(t => `✅ ${DOC_TYPES.find(d=>d.key===t)?.label||t}`).join('\n')}\n${missing.map(t => `❌ ${DOC_TYPES.find(d=>d.key===t)?.label||t} (Missing)`).join('\n')}\n\n📅 ${new Date().toLocaleDateString('en-IN')}\n🏍️ VP Honda, Bhopal\n📞 9713394738`;

    sendWhatsApp(phone, msg);

    const ins_docs_found = folderDocs.filter(d => INS_DOCS.includes(d.docType));
    if (ins_docs_found.length > 0) {
      setTimeout(() => {
        if (window.confirm(`${ins_docs_found.length} document photos अलग-अलग share करने हैं?\n\n(हर photo एक नए tab में खुलेगा)`)) {
          ins_docs_found.forEach((d, i) => {
            setTimeout(() => {
              const w = window.open('', '_blank');
              if (w) {
                w.document.write(`<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${d.photo}" style="max-width:100%;max-height:100vh;" title="${d.docTypeLabel}"/></body></html>`);
              }
            }, i * 800);
          });
        }
      }, 1000);
    }
  };

  // ── RTO WhatsApp ──────────────────────────────────────────────────────────────
  const sendRTO = (folderDocs, customerName, customerPhone) => {
    const available = RTO_DOCS.filter(t => folderDocs.some(d => d.docType === t));
    const missing   = RTO_DOCS.filter(t => !folderDocs.some(d => d.docType === t));

    const phone = prompt(
      `🚗 RTO Documents WhatsApp करें\n\nAvailable: ${available.length}/${RTO_DOCS.length} documents\n${missing.length>0?`Missing: ${missing.map(t=>DOC_TYPES.find(d=>d.key===t)?.label||t).join(', ')}\n`:''}\nRTO Agent (Pal) का WhatsApp number डालें:`
    );
    if (!phone) return;

    const firstDoc = folderDocs[0];
    const msg = `🚗 *VP Honda — RTO Documents*\n\n👤 Customer: ${customerName}\n📞 ${customerPhone || '-'}\n🏍️ ${firstDoc?.vehicleModel || ''}\n🔢 Chassis: ${firstDoc?.chassisNo || ''}\n\nDocuments:\n${available.map(t => `✅ ${DOC_TYPES.find(d=>d.key===t)?.label||t}`).join('\n')}\n${missing.map(t => `❌ ${DOC_TYPES.find(d=>d.key===t)?.label||t} (Missing)`).join('\n')}\n\n📅 ${new Date().toLocaleDateString('en-IN')}\n🏍️ VP Honda, Bhopal\n📞 9713394738`;

    sendWhatsApp(phone, msg);

    const rto_docs_found = folderDocs.filter(d => RTO_DOCS.includes(d.docType));
    if (rto_docs_found.length > 0) {
      setTimeout(() => {
        if (window.confirm(`${rto_docs_found.length} document photos share करने हैं?`)) {
          rto_docs_found.forEach((d, i) => {
            setTimeout(() => {
              const w = window.open('', '_blank');
              if (w) {
                w.document.write(`<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${d.photo}" style="max-width:100%;max-height:100vh;" title="${d.docTypeLabel}"/></body></html>`);
              }
            }, i * 800);
          });
        }
      }, 1000);
    }
  };

  // ── Filtered view ─────────────────────────────────────────────────────────────
  const filtered = view === 'all'
    ? docs.filter(d => !search || d.customerName.toLowerCase().includes(search.toLowerCase()) || (d.customerPhone||'').includes(search) || d.docTypeLabel.toLowerCase().includes(search.toLowerCase()) || (d.aadharNo||'').includes(search))
    : docs.filter(d => {
        const key = d.folder || folderKey(d.customerName, d.savedAt);
        return key === activeFolder;
      });

  const expiringSoon = docs.filter(d => { if(!d.expiryDate) return false; const c=checkExpiry(d.expiryDate, d.docTypeLabel); return c && c.status !== 'ok'; });

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:14, background:'#020617', minHeight:'100vh', color:'#fff' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:800, margin:0, display:'flex', alignItems:'center', gap:8 }}>
            <FolderOpen size={20}/> Document Vault
          </h1>
          <p style={{ color:'#94a3b8', fontSize:12, margin:'4px 0 0' }}>
            {docs.length} documents · {folderList.length} customers · Customer-wise folders
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ background:'linear-gradient(135deg,#DC0000,#B91C1C)', color:'#fff', border:'none', padding:'10px 16px', borderRadius:10, fontWeight:700, fontSize:13, cursor:'pointer' }}>
          + Add Document
        </button>
      </div>

      {/* Expiry Alerts */}
      {expiringSoon.length > 0 && (
        <div style={{ background:'#7c2d1222', border:'1px solid #ea580c', borderRadius:10, padding:'10px 14px', marginBottom:12 }}>
          <p style={{ color:'#fdba74', fontWeight:700, fontSize:13, margin:'0 0 6px', display:'flex', alignItems:'center', gap:6 }}>
            <AlertTriangle size={14}/> {expiringSoon.length} Documents Expire Soon!
          </p>
          {expiringSoon.map((d,i) => {
            const check = checkExpiry(d.expiryDate, d.docTypeLabel);
            return <p key={i} style={{ color:'#fed7aa', fontSize:12, margin:'4px 0 0' }}>{d.docIcon} {d.customerName} · {d.docTypeLabel} · {check?.msg}</p>;
          })}
        </div>
      )}

      {/* Search + View Toggle */}
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <Search size={14} style={{ position:'absolute', left:12, top:11, color:'#64748b' }}/>
          <input value={search} onChange={e => { setSearch(e.target.value); setView('all'); if(!e.target.value) setView('folders'); }}
            placeholder="Customer name, Aadhar, phone search..."
            style={{ background:'#1e293b', color:'#fff', border:'1px solid #475569', borderRadius:8, padding:'10px 12px 10px 34px', fontSize:13, width:'100%', outline:'none' }}/>
        </div>
        <button onClick={() => { setView('folders'); setSearch(''); setActiveFolder(null); }}
          style={{ background:view==='folders'?'#DC0000':'#1e293b', color:'#fff', border:'none', padding:'8px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>
          📁 Folders
        </button>
        <button onClick={() => setView('all')}
          style={{ background:view==='all'?'#DC0000':'#1e293b', color:'#fff', border:'none', padding:'8px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>
          📋 All Docs
        </button>
      </div>

      {/* FOLDER VIEW */}
      {view === 'folders' && !activeFolder && (
        <div style={{ display:'grid', gap:8 }}>
          {folderList.length === 0 ? (
            <div style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:12, padding:40, textAlign:'center', color:'#64748b' }}>
              कोई document नहीं। "+ Add Document" दबाएं।
            </div>
          ) : folderList.map(([key, folder]) => {
            const hasIns = INS_DOCS.every(t => folder.docs.some(d => d.docType === t));
            const hasRTO = RTO_DOCS.every(t => folder.docs.some(d => d.docType === t));
            const insCount = INS_DOCS.filter(t => folder.docs.some(d => d.docType === t)).length;
            const rtoCount = RTO_DOCS.filter(t => folder.docs.some(d => d.docType === t)).length;
            return (
              <div key={key} style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:12, padding:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <div style={{ width:44, height:44, borderRadius:10, background:'#1e40af', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                    📁
                  </div>
                  <div style={{ flex:1, minWidth:150, cursor:'pointer' }} onClick={() => { setActiveFolder(key); setView('folder_detail'); }}>
                    <p style={{ fontWeight:800, fontSize:14, margin:0 }}>{folder.name}</p>
                    <p style={{ color:'#94a3b8', fontSize:11, margin:'3px 0 0' }}>
                      📞 {folder.phone || '-'} · {folder.docs.length} docs · 📅 {new Date(folder.date).toLocaleDateString('en-IN')}
                    </p>
                    <div style={{ display:'flex', gap:4, marginTop:6, flexWrap:'wrap' }}>
                      {folder.docs.map((d,i) => (
                        <span key={i} style={{ background:'#1e293b', color:'#cbd5e1', padding:'2px 6px', borderRadius:4, fontSize:9, fontWeight:600 }}>
                          {d.docIcon} {d.docTypeLabel}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <button
                      onClick={() => sendInsurance(folder.docs, folder.name, folder.phone)}
                      style={{
                        background: insCount >= 3 ? 'linear-gradient(135deg,#16a34a,#15803d)' : '#334155',
                        color:'#fff', border:'none', padding:'7px 12px', borderRadius:8,
                        fontWeight:700, fontSize:11, cursor:'pointer',
                        display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap',
                      }}>
                      🛡️ Insurance ({insCount}/{INS_DOCS.length})
                    </button>
                    <button
                      onClick={() => sendRTO(folder.docs, folder.name, folder.phone)}
                      style={{
                        background: rtoCount >= 3 ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : '#334155',
                        color:'#fff', border:'none', padding:'7px 12px', borderRadius:8,
                        fontWeight:700, fontSize:11, cursor:'pointer',
                        display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap',
                      }}>
                      🚗 RTO ({rtoCount}/{RTO_DOCS.length})
                    </button>
                  </div>
                  <ChevronRight size={16} color="#64748b" style={{ cursor:'pointer' }} onClick={() => { setActiveFolder(key); setView('folder_detail'); }}/>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FOLDER DETAIL VIEW */}
      {view === 'folder_detail' && activeFolder && (() => {
        const folder = folders[activeFolder];
        if (!folder) return null;
        const insCount = INS_DOCS.filter(t => folder.docs.some(d => d.docType === t)).length;
        const rtoCount = RTO_DOCS.filter(t => folder.docs.some(d => d.docType === t)).length;
        return (
          <div>
            <div style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:12, padding:14, marginBottom:14 }}>
              <button onClick={() => { setActiveFolder(null); setView('folders'); }}
                style={{ background:'#1e293b', border:'none', color:'#94a3b8', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:11, marginBottom:10 }}>
                ← Back to Folders
              </button>
              <h2 style={{ fontSize:16, fontWeight:800, margin:'0 0 4px' }}>📁 {folder.name}</h2>
              <p style={{ color:'#94a3b8', fontSize:12, margin:0 }}>📞 {folder.phone || '-'} · {folder.docs.length} documents</p>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:12 }}>
                <button onClick={() => sendInsurance(folder.docs, folder.name, folder.phone)}
                  style={{ background:'linear-gradient(135deg,#16a34a,#15803d)', color:'#fff', border:'none', padding:'12px', borderRadius:10, fontWeight:800, fontSize:13, cursor:'pointer', textAlign:'left' }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>🛡️</div>
                  <div>Insurance Documents</div>
                  <div style={{ fontSize:10, opacity:0.8, marginTop:2 }}>{insCount}/{INS_DOCS.length} ready · WhatsApp भेजें</div>
                  {INS_DOCS.map(t => (
                    <div key={t} style={{ fontSize:10, marginTop:2 }}>
                      {folder.docs.some(d => d.docType===t) ? '✅' : '❌'} {DOC_TYPES.find(d=>d.key===t)?.label}
                    </div>
                  ))}
                </button>
                <button onClick={() => sendRTO(folder.docs, folder.name, folder.phone)}
                  style={{ background:'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'#fff', border:'none', padding:'12px', borderRadius:10, fontWeight:800, fontSize:13, cursor:'pointer', textAlign:'left' }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>🚗</div>
                  <div>RTO Documents</div>
                  <div style={{ fontSize:10, opacity:0.8, marginTop:2 }}>{rtoCount}/{RTO_DOCS.length} ready · WhatsApp भेजें</div>
                  {RTO_DOCS.map(t => (
                    <div key={t} style={{ fontSize:10, marginTop:2 }}>
                      {folder.docs.some(d => d.docType===t) ? '✅' : '❌'} {DOC_TYPES.find(d=>d.key===t)?.label}
                    </div>
                  ))}
                </button>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
              {folder.docs.map(d => (
                <DocCard key={d.id} doc={d} onView={() => setViewDoc(d)} onDelete={() => deleteDoc(d.id)}/>
              ))}
              <div onClick={() => { 
                setForm(f => ({...f, customerName: folder.name, customerPhone: folder.phone || ''}));
                setCustSearch(folder.name);
                setShowForm(true);
              }}
                style={{ background:'#0f172a', border:'2px dashed #334155', borderRadius:12, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20, cursor:'pointer', gap:6, minHeight:140 }}>
                <span style={{ fontSize:28 }}>➕</span>
                <span style={{ color:'#64748b', fontSize:11, fontWeight:700 }}>Add Document</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ALL DOCS VIEW */}
      {view === 'all' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
          {filtered.length === 0
            ? <div style={{ gridColumn:'1/-1', background:'#0f172a', border:'1px solid #1e293b', borderRadius:12, padding:30, textAlign:'center', color:'#64748b' }}>
                {search ? `"${search}" के लिए कोई document नहीं` : 'कोई document नहीं'}
              </div>
            : filtered.map(d => <DocCard key={d.id} doc={d} onView={() => setViewDoc(d)} onDelete={() => deleteDoc(d.id)}/>)
          }
        </div>
      )}

      {/* View Full Image Modal */}
      {viewDoc && (
        <div onClick={() => setViewDoc(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#0f172a', borderRadius:14, overflow:'hidden', maxWidth:640, width:'100%', maxHeight:'94vh', display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderBottom:'1px solid #1e293b' }}>
              <div>
                <p style={{ fontWeight:800, fontSize:14, margin:0 }}>{viewDoc.docIcon} {viewDoc.docTypeLabel}</p>
                <p style={{ color:'#94a3b8', fontSize:11, margin:'2px 0 0' }}>{viewDoc.customerName} · {viewDoc.customerPhone}</p>
                {viewDoc.aadharNo && <p style={{ color:'#64748b', fontSize:10, margin:'2px 0 0' }}>Aadhar: {viewDoc.aadharNo}</p>}
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => { const a=document.createElement('a'); a.href=viewDoc.photo; a.download=`${viewDoc.customerName}_${viewDoc.docType}.jpg`; a.click(); }}
                  style={{ background:'#16a34a', color:'#fff', border:'none', padding:'6px 10px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>⬇️</button>
                <button onClick={() => setViewDoc(null)}
                  style={{ background:'#475569', color:'#fff', border:'none', padding:'6px 10px', borderRadius:6, cursor:'pointer' }}><X size={16}/></button>
              </div>
            </div>
            <div style={{ flex:1, overflow:'auto' }}>
              <img src={viewDoc.photo} alt={viewDoc.docTypeLabel} style={{ width:'100%', height:'auto', display:'block' }}/>
            </div>
          </div>
        </div>
      )}

      {/* Add Document Modal with search dropdown and multi-doc support */}
      {showForm && (
        <div onClick={() => { setShowForm(false); setPhoto(null); }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', padding:16, zIndex:50 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:14, width:'100%', maxWidth:500, padding:20, maxHeight:'94vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
              <h2 style={{ fontSize:16, fontWeight:800, margin:0 }}>📄 Add Document</h2>
              <button onClick={() => { setShowForm(false); setPhoto(null); }} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer' }}><X size={18}/></button>
            </div>

            <div style={{ display:'grid', gap:10 }}>
              {/* Customer Name with dropdown */}
              <div style={{ position:'relative' }} ref={dropdownRef}>
                <label style={lbl}>Customer Name *</label>
                <input
                  value={custSearch}
                  onChange={e => handleCustNameChange(e.target.value)}
                  onFocus={() => custSearch.trim().length >= 2 && setShowDropdown(true)}
                  placeholder="नाम डालें — मिलते ही सुझाव दिखेंगे"
                  style={inp}
                  autoComplete="off"
                />
                {showDropdown && filteredCustomers.length > 0 && (
                  <div style={{
                    position:'absolute', top:'100%', left:0, right:0, background:'#1e293b',
                    border:'1px solid #475569', borderRadius:8, marginTop:4, maxHeight:200, overflowY:'auto', zIndex:60
                  }}>
                    {filteredCustomers.map((c, idx) => (
                      <div key={idx}
                        onClick={() => selectCustomer(c)}
                        style={{ padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid #334155', color:'#e2e8f0', fontSize:13 }}
                      >
                        <strong>{c.customerName || c.name}</strong><br/>
                        <span style={{ fontSize:11, color:'#94a3b8' }}>📞 {c.mobileNo || c.phone} · 🪪 {c.aadhar || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Phone */}
              <div>
                <label style={lbl}>Mobile Number</label>
                <input value={form.customerPhone} onChange={e => setForm({...form, customerPhone: e.target.value.replace(/\D/g,'')})}
                  placeholder="10-digit mobile" maxLength={10} style={inp}/>
              </div>

              {/* Aadhar No */}
              <div>
                <label style={lbl}>Aadhar Number</label>
                <input value={form.aadharNo} onChange={e => setForm({...form, aadharNo: e.target.value.replace(/\D/g,'').slice(0,12)})}
                  placeholder="12-digit Aadhar number" maxLength={12} style={inp}/>
              </div>

              {/* Vehicle Model */}
              <div>
                <label style={lbl}>Vehicle Model</label>
                <input value={form.vehicleModel} onChange={e => setForm({...form, vehicleModel: e.target.value})}
                  placeholder="e.g., ACTIVA STD" style={inp}/>
              </div>

              {/* Chassis No */}
              <div>
                <label style={lbl}>Chassis / Engine No</label>
                <input value={form.chassisNo} onChange={e => setForm({...form, chassisNo: e.target.value.toUpperCase()})}
                  placeholder="e.g., ME4JC658NMT..." style={inp}/>
              </div>

              {/* Document Type */}
              <div>
                <label style={lbl}>Document Type *</label>
                <select value={form.docType} onChange={e => setForm({...form, docType: e.target.value})} style={inp}>
                  {DOC_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
                </select>
              </div>

              {/* Expiry date */}
              {DOC_TYPES.find(t => t.key === form.docType)?.hasExpiry && (
                <div>
                  <label style={lbl}>Expiry Date</label>
                  <input type="date" value={form.expiryDate} onChange={e => setForm({...form, expiryDate: e.target.value})} style={inp}/>
                </div>
              )}

              {/* Notes */}
              <div>
                <label style={lbl}>Notes (Optional)</label>
                <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Optional" style={inp}/>
              </div>

              {/* Photo — Camera + Gallery */}
              <div>
                <label style={lbl}>📷 Document Photo *</label>
                {photo ? (
                  <div style={{ position:'relative' }}>
                    <img src={photo} alt="preview" style={{ width:'100%', borderRadius:8, border:'1px solid #16a34a', maxHeight:200, objectFit:'cover' }}/>
                    <button onClick={() => setPhoto(null)} style={{ position:'absolute', top:6, right:6, background:'#dc2626', color:'#fff', border:'none', borderRadius:'50%', width:26, height:26, cursor:'pointer', fontWeight:700 }}>×</button>
                    <p style={{ color:'#86efac', fontSize:11, margin:'4px 0 0', textAlign:'center' }}>✅ Photo ready</p>
                  </div>
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <button onClick={capturePhoto} disabled={capturing}
                      style={{ background:'#1e3a8a', color:'#fff', border:'2px dashed #3b82f6', borderRadius:8, padding:'16px 10px', fontSize:12, fontWeight:700, cursor:'pointer', textAlign:'center' }}>
                      <Camera size={22} style={{ margin:'0 auto 6px', display:'block' }}/>
                      {capturing ? '⏳ Opening...' : '📷 Camera'}
                    </button>
                    <button onClick={pickFromGallery}
                      style={{ background:'#1a1a2e', color:'#fff', border:'2px dashed #a855f7', borderRadius:8, padding:'16px 10px', fontSize:12, fontWeight:700, cursor:'pointer', textAlign:'center' }}>
                      <Image size={22} style={{ margin:'0 auto 6px', display:'block' }}/>
                      🖼️ Gallery
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Two save buttons: Save & Add Another / Save & Close */}
            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              <button onClick={() => saveDoc(true)} disabled={!photo}
                style={{ flex:1, background:photo?'#2563eb':'#475569', color:'#fff', border:'none', padding:12, borderRadius:10, fontWeight:800, cursor:photo?'pointer':'not-allowed' }}>
                ➕ Save & Add Another
              </button>
              <button onClick={() => saveDoc(false)} disabled={!photo}
                style={{ flex:1, background:photo?'#DC0000':'#475569', color:'#fff', border:'none', padding:12, borderRadius:10, fontWeight:800, cursor:photo?'pointer':'not-allowed' }}>
                💾 Save & Close
              </button>
            </div>
            {!photo && <p style={{ color:'#ef4444', fontSize:10, marginTop:6 }}>* Photo is required</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mini doc card component ────────────────────────────────────────────────────
function DocCard({ doc, onView, onDelete }) {
  return (
    <div style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:10, overflow:'hidden' }}>
      <div onClick={onView} style={{ cursor:'pointer', position:'relative', height:110, overflow:'hidden', background:'#1e293b' }}>
        <img src={doc.photo} alt={doc.docTypeLabel} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
        <div style={{ position:'absolute', top:4, left:4, background:'rgba(0,0,0,0.75)', padding:'2px 6px', borderRadius:3, fontSize:9, fontWeight:700 }}>
          {doc.docIcon} {doc.docTypeLabel}
        </div>
      </div>
      <div style={{ padding:'8px 10px' }}>
        <p style={{ fontWeight:700, fontSize:11, margin:'0 0 2px', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{doc.customerName}</p>
        <p style={{ color:'#64748b', fontSize:9, margin:0 }}>{new Date(doc.savedAt).toLocaleDateString('en-IN')}</p>
        <div style={{ display:'flex', gap:4, marginTop:6 }}>
          <button onClick={onView} style={{ flex:1, background:'#1e40af', color:'#fff', border:'none', padding:'4px', borderRadius:4, fontSize:9, fontWeight:700, cursor:'pointer' }}>👁️</button>
          <button onClick={onDelete} style={{ background:'#7f1d1d', color:'#fff', border:'none', padding:'4px 8px', borderRadius:4, fontSize:9, fontWeight:700, cursor:'pointer' }}>🗑️</button>
        </div>
      </div>
    </div>
  );
}

const lbl = { color:'#94a3b8', fontSize:11, fontWeight:700, marginBottom:4, display:'block' };
const inp = { background:'#1e293b', color:'#fff', border:'1px solid #475569', borderRadius:8, padding:'10px 12px', fontSize:13, width:'100%', outline:'none' };
