// DocumentVault.jsx — VP Honda Document Vault (Auto-compress, New Doc Types, Cloud+Offline)

import { useState, useEffect, useRef } from 'react';
import { FolderOpen, Camera, X, AlertTriangle, Search, Image, ChevronRight, FileText, Video, Download, Upload } from 'lucide-react';
import { captureFromCamera, checkExpiry, showInAppToast, sendWhatsApp } from '../utils/smartUtils';
import { api } from '../utils/apiConfig';

// ─── नए डॉक्यूमेंट टाइप (Delivery, Old RC, Old NOC जोड़े गए) ─────────────────────
const DOC_TYPES = [
  { key:'aadhar',        label:'Aadhar Card',          icon:'🪪', hasExpiry:false },
  { key:'pan',           label:'PAN Card',              icon:'💳', hasExpiry:false },
  { key:'chassis_trace', label:'Chassis Trace Page',   icon:'📋', hasExpiry:false },
  { key:'tax_invoice',   label:'Tax Invoice',           icon:'🧾', hasExpiry:false },
  { key:'challan',       label:'Challan',               icon:'📜', hasExpiry:false },
  { key:'chassis_photo', label:'Chassis Photo',         icon:'🔢', hasExpiry:false },
  { key:'chassis_video', label:'Chassis Video',         icon:'🎥', hasExpiry:false },
  { key:'delivery_photo',label:'Delivery Photo',        icon:'📸', hasExpiry:false },
  { key:'old_rc',        label:'Old RC Card',           icon:'🪪', hasExpiry:false },
  { key:'old_noc',       label:'Old Bike NOC',          icon:'📑', hasExpiry:false },
  { key:'rto_form',      label:'RTO Form',              icon:'🚗', hasExpiry:false },
  { key:'rc',            label:'RC Book',               icon:'📄', hasExpiry:false },
  { key:'insurance',     label:'Insurance Policy',      icon:'🛡️', hasExpiry:true  },
  { key:'puc',           label:'PUC Certificate',       icon:'🔬', hasExpiry:true  },
  { key:'other',         label:'Other Document',        icon:'📁', hasExpiry:false },
];

// इन्स्योरेंस और RTO के लिए आवश्यक डॉक्यूमेंट (पहले जैसे)
const INS_DOCS = ['aadhar','pan','chassis_trace','tax_invoice','challan'];
const RTO_DOCS = ['aadhar','pan','tax_invoice','chassis_photo','insurance'];

const DEFAULT_INSURANCE_NUMBER = '918770259361';
const DEFAULT_RTO_NUMBER = '919752538014';

const folderKey = (name, date) => {
  const d = date ? new Date(date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'}) : new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'});
  return `${(name || 'Unknown').replace(/\s+/g,'_')}_${d}`;
};

// ── इमेज कंप्रेस फंक्शन (canvas के ज़रिए) ──
async function compressImage(dataUrl, maxWidth=1200, quality=0.8) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    img.src = dataUrl;
  });
}

// ── हेल्पर: फाइल को DataURL में बदले और इमेज हो तो कंप्रेस करे ──
async function processFile(file, fileType) {
  return new Promise((resolve, reject) => {
    if (file.size > 30 * 1024 * 1024) {
      alert('फाइल 30MB से छोटी होनी चाहिए');
      reject('Too large');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      let dataUrl = e.target.result;
      if (fileType === 'image') {
        try {
          dataUrl = await compressImage(dataUrl);
        } catch(err) { console.warn('Compress failed', err); }
      }
      resolve({ dataUrl, fileType, fileName: file.name });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DocumentVault() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ 
    customerName:'', customerPhone:'', aadharNo:'', vehicleModel:'', chassisNo:'', 
    nomineeName:'', docType:'aadhar', expiryDate:'', notes:''
  });
  const [fileData, setFileData] = useState(null); // { dataUrl, fileType, fileName }
  const [capturing, setCapturing] = useState(false);
  const [viewDoc, setViewDoc] = useState(null);
  const [activeFolder, setActiveFolder] = useState(null);
  const [view, setView] = useState('folders');
  const [customers, setCustomers] = useState([]);
  const [useCloud, setUseCloud] = useState(true);

  // Customer search dropdown
  const [custSearch, setCustSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // ── लोड डॉक्यूमेंट (पहले क्लाउड, फिर लोकल) ──
  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await api('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocs(data);
        setUseCloud(true);
        showInAppToast('☁️ क्लाउड से लोड हुए', '', 'success');
        setLoading(false);
        return;
      }
    } catch (err) {}
    // fallback
    try {
      const local = JSON.parse(localStorage.getItem('vp_documents') || '[]');
      setDocs(local);
      setUseCloud(false);
      showInAppToast('📱 ऑफलाइन मोड – सिर्फ इस डिवाइस पर', '', 'info');
    } catch(e) { setDocs([]); }
    setLoading(false);
  };

  // ── सेव डॉक्यूमेंट (कंप्रेस हो चुका होगा) ──
  const saveDoc = async (stayOpen = false) => {
    if (!form.customerName || !fileData) {
      alert('कृपया कस्टमर नाम और फाइल चुनें');
      return;
    }
    const docType = DOC_TYPES.find(d => d.key === form.docType) || DOC_TYPES[0];
    const now = new Date().toISOString();
    const newDoc = {
      id: `doc_${Date.now()}_${Math.random()}`,
      folder: folderKey(form.customerName, now),
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      aadharNo: form.aadharNo,
      vehicleModel: form.vehicleModel,
      chassisNo: form.chassisNo,
      nomineeName: form.nomineeName,
      docType: form.docType,
      docTypeLabel: docType.label,
      docIcon: docType.icon,
      expiryDate: form.expiryDate,
      notes: form.notes,
      fileData: fileData.dataUrl,
      fileType: fileData.fileType,
      fileName: fileData.fileName,
      savedAt: now,
    };

    let saved = false;
    if (useCloud) {
      try {
        const res = await api('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newDoc),
        });
        if (res.ok) {
          const savedDoc = await res.json();
          setDocs(prev => [savedDoc, ...prev]);
          saved = true;
          showInAppToast('☁️ क्लाउड में सेव हुआ', '', 'success');
        } else throw new Error();
      } catch (err) {
        // cloud fail → local
      }
    }
    if (!saved) {
      const updated = [newDoc, ...docs];
      localStorage.setItem('vp_documents', JSON.stringify(updated));
      setDocs(updated);
      setUseCloud(false);
      showInAppToast('📀 इस डिवाइस पर सेव हुआ (ऑफलाइन)', '', 'info');
    }

    if (!stayOpen) {
      setShowForm(false);
      setFileData(null);
      setForm({ customerName:'', customerPhone:'', aadharNo:'', vehicleModel:'', chassisNo:'', nomineeName:'', docType:'aadhar', expiryDate:'', notes:'' });
      setCustSearch('');
    } else {
      setFileData(null);
      setForm({ ...form, docType:'aadhar', expiryDate:'', notes:'' });
    }
  };

  const deleteDoc = async (id) => {
    if (!window.confirm('डिलीट करें?')) return;
    if (useCloud) {
      try {
        const res = await api(`/api/documents/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setDocs(prev => prev.filter(d => d.id !== id));
          showInAppToast('🗑️ डिलीट हो गया', '', 'success');
          return;
        }
      } catch (err) {}
    }
    // local delete
    const updated = docs.filter(d => d.id !== id);
    localStorage.setItem('vp_documents', JSON.stringify(updated));
    setDocs(updated);
    showInAppToast('🗑️ स्थानीय डॉक्यूमेंट डिलीट हुआ', '', 'success');
  };

  // ── फाइल पिकर (इमेज, PDF, वीडियो, कैमरा) ──
  const capturePhoto = async () => {
    setCapturing(true);
    try {
      const rawImg = await captureFromCamera('environment');
      // कैमरा से आई इमेज को कंप्रेस करें
      const compressed = await compressImage(rawImg);
      setFileData({ dataUrl: compressed, fileType: 'image', fileName: 'camera_photo.jpg' });
      showInAppToast('📷 फोटो कैप्चर+कंप्रेस', '', 'success');
    } catch(e) {
      showInAppToast('❌ कैमरा एरर', String(e), 'error');
    }
    setCapturing(false);
  };

  const pickFromGallery = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg, image/png, image/jpg';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const processed = await processFile(file, 'image');
        setFileData(processed);
      } catch(err) { alert('फाइल प्रोसेस नहीं हुई'); }
    };
    input.click();
  };

  const pickPDF = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const processed = await processFile(file, 'pdf');
        setFileData(processed);
      } catch(err) { alert('PDF प्रोसेस नहीं हुई'); }
    };
    input.click();
  };

  const pickVideo = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4, video/quicktime';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const processed = await processFile(file, 'video');
        setFileData(processed);
      } catch(err) { alert('वीडियो प्रोसेस नहीं हुई'); }
    };
    input.click();
  };

  // ── बैकअप और रिस्टोर (ऑफलाइन मोड के लिए) ──
  const backupData = () => {
    const dataStr = JSON.stringify(docs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vp_docs_backup_${new Date().toISOString().slice(0,19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showInAppToast('📦 बैकअप बना', `${docs.length} docs`, 'success');
  };

  const restoreData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target.result);
          if (Array.isArray(imported)) {
            localStorage.setItem('vp_documents', JSON.stringify(imported));
            setDocs(imported);
            showInAppToast('✅ रिस्टोर हो गया', `${imported.length} docs`, 'success');
            setActiveFolder(null);
            setView('folders');
          } else alert('गलत फाइल');
        } catch (err) { alert('फाइल पढ़ने में एरर'); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // ── कस्टमर ऑटोफिल (वही रहेगा) ──
  useEffect(() => {
    fetch(api('/api/customers')).then(r => r.ok ? r.json() : []).then(setCustomers).catch(() => {});
    loadDocuments();
  }, []);

  const filteredCustomers = custSearch.trim().length >= 2
    ? customers.filter(c =>
        (c.customerName || c.name || '').toLowerCase().includes(custSearch.toLowerCase()) ||
        (c.mobileNo || c.phone || '').includes(custSearch) ||
        (c.aadhar || '').includes(custSearch)
      ).slice(0, 8)
    : [];

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

  const handleCustNameChange = (value) => {
    setCustSearch(value);
    setForm({ ...form, customerName: value });
    setShowDropdown(value.trim().length >= 2);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── फोल्डर ग्रुपिंग ──
  const folders = docs.reduce((acc, d) => {
    const key = d.folder || folderKey(d.customerName, d.savedAt);
    if (!acc[key]) acc[key] = { name: d.customerName, phone: d.customerPhone, docs: [], date: d.savedAt, nomineeName: d.nomineeName };
    acc[key].docs.push(d);
    if (d.nomineeName) acc[key].nomineeName = d.nomineeName;
    return acc;
  }, {});
  const folderList = Object.entries(folders).sort((a,b) => new Date(b[1].date) - new Date(a[1].date));

  // ── व्हाट्सएप फंक्शन (पिछले जैसे) ──
  const sendInsurance = (folderDocs, folder) => {
    const available = INS_DOCS.filter(t => folderDocs.some(d => d.docType === t));
    const missing = INS_DOCS.filter(t => !folderDocs.some(d => d.docType === t));
    const nomineeName = folder.nomineeName || '—';
    let phone = prompt(`Insurance WhatsApp number (NBV Honda):`, DEFAULT_INSURANCE_NUMBER);
    if (!phone) return;
    const msg = `🛡️ *VP Honda — Insurance*\n👤 ${folder.name}\n📞 ${folder.phone}\n👥 Nominee: ${nomineeName}\n✅ ${available.map(t=>DOC_TYPES.find(d=>d.key===t)?.label).join('\n✅ ')}\n❌ ${missing.map(t=>DOC_TYPES.find(d=>d.key===t)?.label).join(', ')}`;
    sendWhatsApp(phone, msg);
    const files = folderDocs.filter(d => INS_DOCS.includes(d.docType));
    if (files.length) setTimeout(() => {
      if (window.confirm(`${files.length} फाइलें शेयर करें?`))
        files.forEach((f,i)=>setTimeout(()=>window.open('', '_blank').document.write(`<html><body><${f.fileType==='video'?'video controls src="'+f.fileData+'"':f.fileType==='pdf'?'iframe src="'+f.fileData+'" style="width:100%;height:100%"':'img src="'+f.fileData+'"'}></body></html>`), i*800));
    }, 1000);
  };

  const sendRTO = (folderDocs, folder) => {
    const available = RTO_DOCS.filter(t => folderDocs.some(d => d.docType === t));
    const missing = RTO_DOCS.filter(t => !folderDocs.some(d => d.docType === t));
    let phone = prompt(`RTO Agent (Pal) number:`, DEFAULT_RTO_NUMBER);
    if (!phone) return;
    const first = folderDocs[0];
    const msg = `🚗 *VP Honda — RTO*\n👤 ${folder.name}\n📞 ${folder.phone}\n🏍️ ${first?.vehicleModel}\n🔢 ${first?.chassisNo}\n✅ ${available.map(t=>DOC_TYPES.find(d=>d.key===t)?.label).join('\n✅ ')}\n❌ ${missing.map(t=>DOC_TYPES.find(d=>d.key===t)?.label).join(', ')}`;
    sendWhatsApp(phone, msg);
    const files = folderDocs.filter(d => RTO_DOCS.includes(d.docType));
    if (files.length) setTimeout(() => {
      if (window.confirm(`${files.length} फाइलें शेयर करें?`))
        files.forEach((f,i)=>setTimeout(()=>window.open('', '_blank').document.write(`<html><body><${f.fileType==='video'?'video controls src="'+f.fileData+'"':f.fileType==='pdf'?'iframe src="'+f.fileData+'" style="width:100%;height:100%"':'img src="'+f.fileData+'"'}></body></html>`), i*800));
    }, 1000);
  };

  const filtered = view === 'all'
    ? docs.filter(d => !search || d.customerName.toLowerCase().includes(search.toLowerCase()) || (d.customerPhone||'').includes(search) || d.docTypeLabel.toLowerCase().includes(search.toLowerCase()) || (d.aadharNo||'').includes(search))
    : docs.filter(d => (d.folder || folderKey(d.customerName, d.savedAt)) === activeFolder);

  const expiringSoon = docs.filter(d => d.expiryDate && checkExpiry(d.expiryDate, d.docTypeLabel)?.status !== 'ok');

  if (loading) return <div style={{padding:20, color:'white', textAlign:'center'}}>📡 लोड हो रहा है...</div>;

  // ------------------- JSX रेंडर (पिछले जैसा, लेकिन Backup/Restore बटन हमेशा नहीं, बल्कि ऑफलाइन हो तो) -------------------
  return (
    <div style={{ padding:14, background:'#020617', minHeight:'100vh', color:'#fff' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:800, margin:0 }}><FolderOpen size={20}/> Document Vault</h1>
          <p style={{ color:'#94a3b8', fontSize:12 }}>{docs.length} docs · {folderList.length} folders {!useCloud && '· 📀 ऑफलाइन'}</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {!useCloud && (
            <>
              <button onClick={backupData} style={{ background:'#2d3748', padding:'8px 12px', borderRadius:8, fontSize:12, cursor:'pointer' }}><Download size={14}/> बैकअप</button>
              <button onClick={restoreData} style={{ background:'#2d3748', padding:'8px 12px', borderRadius:8, fontSize:12, cursor:'pointer' }}><Upload size={14}/> रिस्टोर</button>
            </>
          )}
          <button onClick={() => setShowForm(true)} style={{ background:'linear-gradient(135deg,#DC0000,#B91C1C)', padding:'10px 16px', borderRadius:10, fontWeight:700, cursor:'pointer' }}>+ Add Document</button>
        </div>
      </div>

      {/* Expiry alerts */}
      {expiringSoon.length > 0 && (
        <div style={{ background:'#7c2d1222', border:'1px solid #ea580c', borderRadius:10, padding:'10px 14px', marginBottom:12 }}>
          <p style={{ color:'#fdba74', fontWeight:700, fontSize:13, margin:'0 0 6px', display:'flex', alignItems:'center', gap:6 }}><AlertTriangle size={14}/> {expiringSoon.length} डॉक्यूमेंट जल्दी एक्सपायर होंगे!</p>
          {expiringSoon.map((d,i) => <p key={i} style={{ fontSize:12, margin:'4px 0 0' }}>{d.docIcon} {d.customerName} · {d.docTypeLabel} · {checkExpiry(d.expiryDate, d.docTypeLabel)?.msg}</p>)}
        </div>
      )}

      {/* Search & view toggle */}
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <div style={{ position:'relative', flex:1 }}><Search size={14} style={{ position:'absolute', left:12, top:11, color:'#64748b' }}/><input value={search} onChange={e=>{setSearch(e.target.value); setView('all'); if(!e.target.value) setView('folders');}} placeholder="खोजें..." style={{ background:'#1e293b', color:'#fff', border:'1px solid #475569', borderRadius:8, padding:'10px 12px 10px 34px', width:'100%' }}/></div>
        <button onClick={()=>{setView('folders'); setSearch(''); setActiveFolder(null);}} style={{ background:view==='folders'?'#DC0000':'#1e293b', padding:'8px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>📁 Folders</button>
        <button onClick={()=>setView('all')} style={{ background:view==='all'?'#DC0000':'#1e293b', padding:'8px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>📋 All Docs</button>
      </div>

      {/* Folders view */}
      {view === 'folders' && !activeFolder && (
        <div style={{ display:'grid', gap:8 }}>
          {folderList.length===0 && <div style={{ background:'#0f172a', padding:40, textAlign:'center' }}>कोई डॉक्यूमेंट नहीं</div>}
          {folderList.map(([key, folder]) => {
            const insCount = INS_DOCS.filter(t=>folder.docs.some(d=>d.docType===t)).length;
            const rtoCount = RTO_DOCS.filter(t=>folder.docs.some(d=>d.docType===t)).length;
            return (
              <div key={key} style={{ background:'#0f172a', borderRadius:12, padding:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <div style={{ width:44, height:44, background:'#1e40af', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>📁</div>
                  <div style={{ flex:1, cursor:'pointer' }} onClick={()=>{ setActiveFolder(key); setView('folder_detail'); }}>
                    <p style={{ fontWeight:800, margin:0 }}>{folder.name}</p>
                    <p style={{ color:'#94a3b8', fontSize:11 }}>📞 {folder.phone} · {folder.docs.length} docs</p>
                    {folder.nomineeName && <p style={{ color:'#c084fc', fontSize:10 }}>👥 Nominee: {folder.nomineeName}</p>}
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:6 }}>{folder.docs.map((d,i)=><span key={i} style={{ background:'#1e293b', padding:'2px 6px', borderRadius:4, fontSize:9 }}>{d.docIcon} {d.docTypeLabel}</span>)}</div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <button onClick={()=>sendInsurance(folder.docs, folder)} style={{ background:insCount>=3?'#16a34a':'#334155', padding:'7px 12px', borderRadius:8, fontSize:11, fontWeight:700 }}>🛡️ Insurance ({insCount}/{INS_DOCS.length})</button>
                    <button onClick={()=>sendRTO(folder.docs, folder)} style={{ background:rtoCount>=3?'#7c3aed':'#334155', padding:'7px 12px', borderRadius:8, fontSize:11, fontWeight:700 }}>🚗 RTO ({rtoCount}/{RTO_DOCS.length})</button>
                  </div>
                  <ChevronRight size={16} color="#64748b" style={{ cursor:'pointer' }} onClick={()=>{ setActiveFolder(key); setView('folder_detail'); }}/>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Folder detail view (shortened for length, but structure same) – यहाँ पूरा दूँगा */}
      {view === 'folder_detail' && activeFolder && (() => {
        const folder = folders[activeFolder];
        if (!folder) return null;
        return (
          <div>
            <button onClick={()=>{ setActiveFolder(null); setView('folders'); }} style={{ background:'#1e293b', border:'none', padding:'4px 10px', borderRadius:6, marginBottom:10 }}>← सभी फोल्डर</button>
            <div style={{ background:'#0f172a', borderRadius:12, padding:14, marginBottom:14 }}>
              <h2 style={{ margin:'0 0 4px' }}>{folder.name}</h2>
              <p>📞 {folder.phone} · {folder.docs.length} docs</p>
              {folder.nomineeName && <p>👥 Nominee: {folder.nomineeName}</p>}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:12 }}>
                <button onClick={()=>sendInsurance(folder.docs, folder)} style={{ background:'#16a34a', padding:12, borderRadius:10, textAlign:'left' }}>
                  <div>🛡️ Insurance</div>
                  <div style={{ fontSize:10 }}>{INS_DOCS.filter(t=>folder.docs.some(d=>d.docType===t)).length}/{INS_DOCS.length} ready</div>
                </button>
                <button onClick={()=>sendRTO(folder.docs, folder)} style={{ background:'#7c3aed', padding:12, borderRadius:10, textAlign:'left' }}>
                  <div>🚗 RTO</div>
                  <div style={{ fontSize:10 }}>{RTO_DOCS.filter(t=>folder.docs.some(d=>d.docType===t)).length}/{RTO_DOCS.length} ready</div>
                </button>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
              {folder.docs.map(d => <DocCard key={d.id} doc={d} onView={()=>setViewDoc(d)} onDelete={()=>deleteDoc(d.id)}/>)}
              <div onClick={()=>{ setForm({...form, customerName: folder.name, customerPhone: folder.phone, nomineeName: folder.nomineeName}); setCustSearch(folder.name); setShowForm(true); }} style={{ background:'#0f172a', border:'2px dashed #334155', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', padding:20, cursor:'pointer' }}>➕ Add Document</div>
            </div>
          </div>
        );
      })()}

      {/* All docs view */}
      {view === 'all' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
          {filtered.map(d=> <DocCard key={d.id} doc={d} onView={()=>setViewDoc(d)} onDelete={()=>deleteDoc(d.id)}/>)}
        </div>
      )}

      {/* Full view modal */}
      {viewDoc && <FullViewModal doc={viewDoc} onClose={()=>setViewDoc(null)} />}

      {/* Add Document Modal (with PDF, Video, and auto-compress) */}
      {showForm && (
        <div onClick={()=>{ setShowForm(false); setFileData(null); }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#0f172a', borderRadius:14, maxWidth:500, width:'100%', padding:20, maxHeight:'94vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}><h2>📄 नया डॉक्यूमेंट</h2><button onClick={()=>{ setShowForm(false); setFileData(null); }}><X size={18}/></button></div>
            <div style={{ display:'grid', gap:10 }}>
              <div ref={dropdownRef} style={{ position:'relative' }}>
                <label style={lbl}>Customer Name *</label>
                <input value={custSearch} onChange={e=>handleCustNameChange(e.target.value)} placeholder="नाम टाइप करें" style={inp} autoComplete="off"/>
                {showDropdown && filteredCustomers.length>0 && <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#1e293b', border:'1px solid #475569', borderRadius:8, maxHeight:200, overflowY:'auto', zIndex:60 }}>{filteredCustomers.map((c,i)=><div key={i} onClick={()=>selectCustomer(c)} style={{ padding:'8px 12px', cursor:'pointer' }}><strong>{c.customerName||c.name}</strong><br/><span style={{ fontSize:11 }}>📞 {c.mobileNo||c.phone} · 🪪 {c.aadhar||'—'}</span></div>)}</div>}
              </div>
              <div><label style={lbl}>Mobile Number</label><input value={form.customerPhone} onChange={e=>setForm({...form, customerPhone: e.target.value.replace(/\D/g,'')})} maxLength={10} style={inp}/></div>
              <div><label style={lbl}>Aadhar Number</label><input value={form.aadharNo} onChange={e=>setForm({...form, aadharNo: e.target.value.replace(/\D/g,'').slice(0,12)})} maxLength={12} style={inp}/></div>
              <div><label style={lbl}>Nominee Name</label><input value={form.nomineeName} onChange={e=>setForm({...form, nomineeName: e.target.value})} placeholder="जैसे: Sita Devi" style={inp}/></div>
              <div><label style={lbl}>Vehicle Model</label><input value={form.vehicleModel} onChange={e=>setForm({...form, vehicleModel: e.target.value})} placeholder="SP125" style={inp}/></div>
              <div><label style={lbl}>Chassis No</label><input value={form.chassisNo} onChange={e=>setForm({...form, chassisNo: e.target.value.toUpperCase()})} placeholder="ME4JC94FDTG104998" style={inp}/></div>
              <div><label style={lbl}>Document Type</label><select value={form.docType} onChange={e=>setForm({...form, docType: e.target.value})} style={inp}>{DOC_TYPES.map(t=><option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}</select></div>
              {DOC_TYPES.find(t=>t.key===form.docType)?.hasExpiry && <div><label style={lbl}>Expiry Date</label><input type="date" value={form.expiryDate} onChange={e=>setForm({...form, expiryDate: e.target.value})} style={inp}/></div>}
              <div><label style={lbl}>Notes</label><input value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} placeholder="Optional" style={inp}/></div>

              {/* File upload (auto-compress for images) */}
              <div>
                <label style={lbl}>📎 फाइल अपलोड करें * (फोटो ऑटो कंप्रेस)</label>
                {fileData ? (
                  <div style={{ background:'#1e293b', borderRadius:8, padding:8, position:'relative' }}>
                    <p style={{ fontSize:12, margin:0 }}>✅ {fileData.fileName} ({fileData.fileType})</p>
                    <button onClick={()=>setFileData(null)} style={{ position:'absolute', top:4, right:4, background:'#dc2626', border:'none', borderRadius:'50%', width:24, height:24 }}>×</button>
                  </div>
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <button onClick={capturePhoto} disabled={capturing} style={{ background:'#1e3a8a', padding:'12px', borderRadius:8, fontSize:12, fontWeight:700 }}><Camera size={18}/> कैमरा</button>
                    <button onClick={pickFromGallery} style={{ background:'#1a1a2e', padding:'12px', borderRadius:8, fontSize:12, fontWeight:700 }}><Image size={18}/> गैलरी</button>
                    <button onClick={pickPDF} style={{ background:'#854d0e', padding:'12px', borderRadius:8, fontSize:12, fontWeight:700 }}><FileText size={18}/> PDF</button>
                    <button onClick={pickVideo} style={{ background:'#4c1d95', padding:'12px', borderRadius:8, fontSize:12, fontWeight:700 }}><Video size={18}/> वीडियो</button>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              <button onClick={()=>saveDoc(true)} disabled={!fileData} style={{ flex:1, background:fileData?'#2563eb':'#475569', padding:12, borderRadius:10, fontWeight:800 }}>➕ Save & Add Another</button>
              <button onClick={()=>saveDoc(false)} disabled={!fileData} style={{ flex:1, background:fileData?'#DC0000':'#475569', padding:12, borderRadius:10, fontWeight:800 }}>💾 Save & Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── डॉक्यूमेंट कार्ड ──
function DocCard({ doc, onView, onDelete }) {
  let icon = <Image size={24}/>;
  if (doc.fileType === 'pdf') icon = <FileText size={24}/>;
  if (doc.fileType === 'video') icon = <Video size={24}/>;
  return (
    <div style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:10, overflow:'hidden' }}>
      <div onClick={onView} style={{ cursor:'pointer', height:110, background:'#1e293b', display:'flex', alignItems:'center', justifyContent:'center' }}>{icon}</div>
      <div style={{ padding:8 }}><p style={{ fontWeight:700, fontSize:11, margin:'0 0 2px' }}>{doc.customerName}</p><p style={{ color:'#64748b', fontSize:9 }}>{new Date(doc.savedAt).toLocaleDateString('en-IN')}</p>
      <div style={{ display:'flex', gap:4, marginTop:6 }}><button onClick={onView} style={{ flex:1, background:'#1e40af', padding:'4px', borderRadius:4, fontSize:9 }}>👁️ देखें</button><button onClick={onDelete} style={{ background:'#7f1d1d', padding:'4px', borderRadius:4, fontSize:9 }}>🗑️ हटाएँ</button></div></div>
    </div>
  );
}

// ── फुल स्क्रीन व्यू (इमेज/PDF/वीडियो) ──
function FullViewModal({ doc, onClose }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#0f172a', borderRadius:14, maxWidth:640, width:'100%', maxHeight:'94vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #1e293b', display:'flex', justifyContent:'space-between' }}>
          <div><strong>{doc.docIcon} {doc.docTypeLabel}</strong><br/><span style={{ fontSize:11 }}>{doc.customerName}</span></div>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        <div style={{ flex:1, overflow:'auto', textAlign:'center', padding:10 }}>
          {doc.fileType === 'image' && <img src={doc.fileData} alt={doc.docTypeLabel} style={{ maxWidth:'100%' }}/>}
          {doc.fileType === 'pdf' && <iframe src={doc.fileData} style={{ width:'100%', height:'80vh' }} title="PDF"/>}
          {doc.fileType === 'video' && <video src={doc.fileData} controls style={{ width:'100%', maxHeight:'80vh' }}/>}
        </div>
      </div>
    </div>
  );
}

const lbl = { color:'#94a3b8', fontSize:11, fontWeight:700, marginBottom:4, display:'block' };
const inp = { background:'#1e293b', color:'#fff', border:'1px solid #475569', borderRadius:8, padding:'10px 12px', fontSize:13, width:'100%', outline:'none' };
