// DocumentVault.jsx — VP Honda Document Vault (Complete + MongoDB + All Features)
import { useState, useEffect, useRef } from 'react';
import { FolderOpen, Camera, X, AlertTriangle, Search, Image, ChevronRight, FileText, Video, Share2, Trash2, Eye, RefreshCw } from 'lucide-react';
import { captureFromCamera, checkExpiry, showInAppToast, sendWhatsApp } from '../utils/smartUtils';
import { api, apiFetch } from '../utils/apiConfig';

// ── Document types ─────────────────────────────────────────────────────────────
const DOC_TYPES = [
  { key: 'aadhar',         label: 'Aadhar Card',               icon: '🪪', hasExpiry: false },
  { key: 'pan',            label: 'PAN Card',                  icon: '💳', hasExpiry: false },
  { key: 'vp_tax_invoice', label: 'VP Tax Invoice',            icon: '🧾', hasExpiry: false },
  { key: 'su_tax_invoice', label: 'SU Tax Invoice',            icon: '🧾', hasExpiry: false },
  { key: 'challan',        label: 'Challan / MRC',             icon: '📜', hasExpiry: false },
  { key: 'chassis_trace',  label: 'Chassis Trace (Engine+Chassis No)', icon: '📋', hasExpiry: false },
  { key: 'chassis_photo',  label: 'Chassis Photo',             icon: '🔢', hasExpiry: false },
  { key: 'chassis_video',  label: 'Chassis Video',             icon: '🎥', hasExpiry: false },
  { key: 'delivery_photo', label: 'Delivery Photo',            icon: '📸', hasExpiry: false },
  { key: 'old_rc',         label: 'Old RC Card',               icon: '🪪', hasExpiry: false },
  { key: 'old_noc',        label: 'Old Bike NOC',              icon: '📑', hasExpiry: false },
  { key: 'rto_form',       label: 'RTO Form',                  icon: '🚗', hasExpiry: false },
  { key: 'rc',             label: 'RC Book',                   icon: '📄', hasExpiry: false },
  { key: 'insurance',      label: 'Insurance Policy',          icon: '🛡️', hasExpiry: true  },
  { key: 'puc',            label: 'PUC Certificate',           icon: '🔬', hasExpiry: true  },
  { key: 'bank_passbook',  label: 'Bank Passbook',             icon: '🏦', hasExpiry: false },
  { key: 'signature',      label: 'Customer Signature',        icon: '✍️', hasExpiry: false },
  { key: 'customer_photo', label: 'Customer Photo',            icon: '👤', hasExpiry: false },
  { key: 'other',          label: 'Other Document',            icon: '📁', hasExpiry: false },
];

// Insurance: VP Tax Invoice, Aadhar, PAN, Challan, Chassis Trace
const INSURANCE_REQUIRED_KEYS = ['vp_tax_invoice', 'aadhar', 'pan', 'challan', 'chassis_trace'];
// RTO/Pal: SU Tax Invoice, Insurance, Aadhar, PAN, Chassis Trace, Chassis Photo
const RTO_REQUIRED_KEYS = ['su_tax_invoice', 'insurance', 'aadhar', 'pan', 'chassis_trace', 'chassis_photo'];

const folderKey = (name, date) => {
  const d = date
    ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  return `${(name || 'Unknown').replace(/\s+/g, '_')}_${d}`;
};

// ── Image compression — 3 methods, retry, fallback ───────────────────────────
async function compressImageRobust(dataUrl, maxWidth = 1200, quality = 0.78) {
  const origKB = Math.round(dataUrl.length * 0.75 / 1024);

  // Method 1: createImageBitmap (modern, fast)
  try {
    const response = await fetch(dataUrl);
    const blob     = await response.blob();
    const bitmap   = await createImageBitmap(blob);
    let { width, height } = bitmap;
    if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const compressed = canvas.toDataURL('image/jpeg', quality);
    const compKB = Math.round(compressed.length * 0.75 / 1024);
    console.log(`[Compress M1] ${origKB}KB → ${compKB}KB (${Math.round(compKB/origKB*100)}%)`);
    return { dataUrl: compressed, sizeKB: compKB, method: 1, origKB };
  } catch (e1) {
    console.warn('[Compress M1 failed]', e1.message);
  }

  // Method 2: Image element (older browsers)
  try {
    const compressed = await new Promise((res, rej) => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        res(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = rej;
      img.src = dataUrl;
    });
    const compKB = Math.round(compressed.length * 0.75 / 1024);
    console.log(`[Compress M2] ${origKB}KB → ${compKB}KB`);
    return { dataUrl: compressed, sizeKB: compKB, method: 2, origKB };
  } catch (e2) {
    console.warn('[Compress M2 failed]', e2.message);
  }

  // Method 3: No compression — return original
  console.warn('[Compress] All methods failed — using original');
  return { dataUrl, sizeKB: origKB, method: 0, origKB, failed: true };
}

// ── File processor with compression status ─────────────────────────────────────
async function processFile(file, type) {
  return new Promise((resolve, reject) => {
    if (file.size > 30 * 1024 * 1024) { alert('फाइल 30MB से छोटी चाहिए'); reject(); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      let dataUrl   = e.target.result;
      let sizeKB    = Math.round(file.size / 1024);
      let compInfo  = null;

      if (type === 'image') {
        compInfo = await compressImageRobust(dataUrl);
        dataUrl  = compInfo.dataUrl;
        sizeKB   = compInfo.sizeKB;
      }

      resolve({
        dataUrl,
        fileType:        type,
        fileName:        file.name,
        sizeKB,
        origKB:          compInfo?.origKB || sizeKB,
        compFailed:      compInfo?.failed || false,
        compMethod:      compInfo?.method,
      });
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

// ── Convert base64 → File object ──────────────────────────────────────────────
function dataURLtoFile(dataURL, fileName, mimeType) {
  try {
    const arr = dataURL.split(',');
    const mime = mimeType || arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], fileName, { type: mime });
  } catch { return null; }
}

// ── Share files (Web Share API with WhatsApp fallback) ────────────────────────
async function shareFilesAuto(docs, textMsg, title) {
  // Try Web Share API (mobile)
  if (navigator.share) {
    const files = docs.map(d => {
      const ext  = d.fileType === 'pdf' ? 'pdf' : d.fileType === 'video' ? 'mp4' : 'jpg';
      const mime = d.fileType === 'pdf' ? 'application/pdf' : d.fileType === 'video' ? 'video/mp4' : 'image/jpeg';
      return dataURLtoFile(d.fileData, `${d.customerName}_${d.docTypeLabel}.${ext}`, mime);
    }).filter(Boolean);

    try {
      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({ title, text: textMsg, files });
        return true;
      }
      // One by one fallback
      for (let i = 0; i < files.length; i++) {
        try {
          await navigator.share({ title: `${title} - ${files[i].name}`, text: i === 0 ? textMsg : `(${i+1}/${files.length})`, files: [files[i]] });
          await new Promise(r => setTimeout(r, 1500));
        } catch (e) { if (e.name !== 'AbortError') console.warn('Share failed:', e.message); }
      }
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
    }
  }
  // WhatsApp text fallback (desktop/older browsers)
  const phone = prompt('📱 WhatsApp number डालें (10 digit):');
  if (phone) sendWhatsApp(phone, textMsg);

  // Also open photos in new tabs for manual sharing
  docs.forEach((d, i) => {
    setTimeout(() => {
      const w = window.open('', '_blank');
      if (w && d.fileData) {
        w.document.write(`<html><body style="margin:0;background:#111;display:flex;flex-direction:column;align-items:center;padding:10px"><p style="color:#fff;font-size:13px">${d.docIcon} ${d.docTypeLabel} — ${d.customerName}</p><img src="${d.fileData}" style="max-width:100%;max-height:90vh"/></body></html>`);
      }
    }, i * 800);
  });
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function DocumentVault() {
  const [docs,         setDocs]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [search,       setSearch]       = useState('');
  const [showForm,     setShowForm]     = useState(false);
  const [form,         setForm]         = useState({
    customerName: '', customerPhone: '', aadharNo: '',
    vehicleModel: '', chassisNo: '', nomineeName: '',
    hypothecation: '', docType: 'aadhar', expiryDate: '', notes: ''
  });
  const [fileData,     setFileData]     = useState(null);
  const [capturing,    setCapturing]    = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [viewDoc,      setViewDoc]      = useState(null);
  const [viewDocData,  setViewDocData]  = useState(null);
  const [activeFolder, setActiveFolder] = useState(null);
  const [view,         setView]         = useState('folders');
  const [customers,    setCustomers]    = useState([]);
  const [custSearch,   setCustSearch]   = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // ── Load documents ──────────────────────────────────────────────────────────
  const loadDocuments = async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch('/api/documents');
      setDocs(Array.isArray(data) ? data : []);
    } catch { setError('❌ Server connect नहीं हुआ। Internet check करें।'); }
    setLoading(false);
  };

  useEffect(() => {
    loadDocuments();
    fetch(api('/api/customers')).then(r => r.ok ? r.json() : []).then(setCustomers).catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const fn = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // ── Customer search/autofill ────────────────────────────────────────────────
  const filteredCustomers = custSearch.trim().length >= 2
    ? customers.filter(c =>
        (c.customerName || c.name || '').toLowerCase().includes(custSearch.toLowerCase()) ||
        (c.mobileNo || c.phone || '').includes(custSearch) ||
        (c.aadhar || '').includes(custSearch)
      ).slice(0, 8)
    : [];

  const selectCustomer = (c) => {
    setForm({ ...form, customerName: c.customerName || c.name || '', customerPhone: c.mobileNo || c.phone || '', aadharNo: c.aadhar || '', vehicleModel: c.vehicleModel || '', chassisNo: c.chassisNo || '' });
    setCustSearch(c.customerName || c.name || '');
    setShowDropdown(false);
  };

  const handleCustNameChange = (value) => {
    setCustSearch(value);
    setForm({ ...form, customerName: value });
    setShowDropdown(value.trim().length >= 2);
  };

  // ── Folders ─────────────────────────────────────────────────────────────────
  const folders = docs.reduce((acc, d) => {
    const key = d.folder || folderKey(d.customerName, d.savedAt);
    if (!acc[key]) acc[key] = { name: d.customerName, phone: d.customerPhone, docs: [], date: d.savedAt, nomineeName: '', hypothecation: '' };
    acc[key].docs.push(d);
    if (d.nomineeName)   acc[key].nomineeName   = d.nomineeName;
    if (d.hypothecation) acc[key].hypothecation = d.hypothecation;
    return acc;
  }, {});
  const folderList = Object.entries(folders).sort((a, b) => new Date(b[1].date) - new Date(a[1].date));

  // ── Save document ────────────────────────────────────────────────────────────
  const saveDoc = async (stayOpen = false) => {
    if (!form.customerName || !fileData) { alert('Customer name और file जरूरी है'); return; }
    setSaving(true);
    const docType = DOC_TYPES.find(d => d.key === form.docType) || DOC_TYPES[0];
    const now = new Date().toISOString();
    const payload = {
      folder: folderKey(form.customerName, now),
      customerName: form.customerName, customerPhone: form.customerPhone,
      aadharNo: form.aadharNo, vehicleModel: form.vehicleModel, chassisNo: form.chassisNo,
      nomineeName: form.nomineeName, hypothecation: form.hypothecation,
      docType: form.docType, docTypeLabel: docType.label, docIcon: docType.icon,
      expiryDate: form.expiryDate, notes: form.notes,
      fileData: fileData.dataUrl, fileType: fileData.fileType, fileName: fileData.fileName,
      savedAt: now,
    };
    try {
      const saved = await apiFetch('/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      setDocs(prev => [saved, ...prev]);
      showInAppToast('☁️ Saved!', docType.label, 'success');
      if (!stayOpen) {
        setShowForm(false); setFileData(null); setCustSearch('');
        setForm({ customerName:'', customerPhone:'', aadharNo:'', vehicleModel:'', chassisNo:'', nomineeName:'', hypothecation:'', docType:'aadhar', expiryDate:'', notes:'' });
      } else {
        setFileData(null);
        setForm(f => ({ ...f, docType: 'aadhar', expiryDate: '', notes: '' }));
      }
    } catch { showInAppToast('❌ Save error', 'Retry करें', 'error'); }
    setSaving(false);
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const deleteDoc = async (id) => {
    if (!id || !window.confirm('Delete करें?')) return;
    await apiFetch(`/api/documents/${id}`, { method: 'DELETE' }).catch(() => {});
    setDocs(prev => prev.filter(d => d.id !== id && d._id !== id));
  };

  // ── Open doc (load fileData) ────────────────────────────────────────────────
  const openDoc = async (doc) => {
    setViewDoc(doc); setViewDocData(null);
    try {
      const full = await apiFetch(`/api/documents/${doc._id || doc.id}`);
      setViewDocData(full.fileData);
    } catch {}
  };

  // ── File pickers ─────────────────────────────────────────────────────────────
  const capturePhoto = async () => {
    setCapturing(true);
    try {
      const raw  = await captureFromCamera('environment');
      const comp = await compressImageRobust(raw);
      setFileData({ dataUrl: comp, fileType: 'image', fileName: 'camera_photo.jpg' });
    } catch (e) { showInAppToast('❌ Camera error', String(e), 'error'); }
    setCapturing(false);
  };
  const pickFromGallery = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/jpg';
    input.onchange = async (e) => { const f = e.target.files?.[0]; if (f) setFileData(await processFile(f, 'image')); };
    input.click();
  };
  const pickPDF = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/pdf';
    input.onchange = async (e) => { const f = e.target.files?.[0]; if (f) setFileData(await processFile(f, 'pdf')); };
    input.click();
  };
  const pickVideo = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'video/mp4,video/quicktime';
    input.onchange = async (e) => { const f = e.target.files?.[0]; if (f) setFileData(await processFile(f, 'video')); };
    input.click();
  };

  // ── Insurance share ──────────────────────────────────────────────────────────
  const sendInsurance = async (folderDocs, folder) => {
    // For sharing, need full fileData — fetch each
    const needed = folderDocs.filter(d => INSURANCE_REQUIRED_KEYS.includes(d.docType));
    if (needed.length === 0) { alert('कोई Insurance document नहीं है।\nजरूरी: VP Tax Invoice, Aadhar, PAN, Challan, Chassis Trace'); return; }

    showInAppToast('⏳', 'Documents load हो रहे हैं...', 'info');
    const withData = await Promise.all(needed.map(async d => {
      try { const full = await apiFetch(`/api/documents/${d._id || d.id}`); return { ...d, fileData: full.fileData }; }
      catch { return null; }
    }));
    const valid = withData.filter(Boolean);

    const msg = `🛡️ *VP Honda — Insurance Documents*\n👤 ${folder.name}\n📞 ${folder.phone || ''}\n👥 Nominee: ${folder.nomineeName || '—'}\n🏦 Hypothecation: ${folder.hypothecation || '—'}\n\n📎 Documents:\n${valid.map(d => `✅ ${d.docTypeLabel}`).join('\n')}${needed.length < INSURANCE_REQUIRED_KEYS.length ? `\n\n❌ Missing:\n${INSURANCE_REQUIRED_KEYS.filter(k => !folderDocs.some(d=>d.docType===k)).map(k => `❌ ${DOC_TYPES.find(t=>t.key===k)?.label||k}`).join('\n')}` : ''}\n\n📅 ${new Date().toLocaleDateString('en-IN')}\n🏍️ VP Honda, Bhopal · 📞 9713394738`;

    await shareFilesAuto(valid, msg, `Insurance - ${folder.name}`);
  };

  // ── RTO/Pal share ────────────────────────────────────────────────────────────
  const sendRTO = async (folderDocs, folder) => {
    const needed = folderDocs.filter(d => RTO_REQUIRED_KEYS.includes(d.docType));
    if (needed.length === 0) { alert('कोई RTO document नहीं है।\nजरूरी: SU Tax Invoice, Insurance, Aadhar, PAN, Chassis Trace, Chassis Photo'); return; }

    showInAppToast('⏳', 'Documents load हो रहे हैं...', 'info');
    const withData = await Promise.all(needed.map(async d => {
      try { const full = await apiFetch(`/api/documents/${d._id || d.id}`); return { ...d, fileData: full.fileData }; }
      catch { return null; }
    }));
    const valid = withData.filter(Boolean);
    const first = folderDocs[0];

    const msg = `🚗 *VP Honda — RTO Documents (Pal)*\n👤 ${folder.name}\n📞 ${folder.phone || ''}\n🏍️ ${first?.vehicleModel || ''}\n🔢 Chassis: ${first?.chassisNo || ''}\n\n📎 Documents:\n${valid.map(d => `✅ ${d.docTypeLabel}`).join('\n')}\n\n📅 ${new Date().toLocaleDateString('en-IN')}\n🏍️ VP Honda, Bhopal · 📞 9713394738`;

    await shareFilesAuto(valid, msg, `RTO - ${folder.name}`);
  };

  // ── Single doc share ─────────────────────────────────────────────────────────
  const shareSingleDoc = async (doc) => {
    let fileDataUrl = doc.fileData;
    if (!fileDataUrl) {
      try { const full = await apiFetch(`/api/documents/${doc._id || doc.id}`); fileDataUrl = full.fileData; }
      catch {}
    }
    if (!fileDataUrl) { alert('File load नहीं हुई'); return; }

    const msg = `📄 *VP Honda Document*\n👤 ${doc.customerName}\n📂 ${doc.docTypeLabel}\n📅 ${new Date(doc.savedAt).toLocaleDateString('en-IN')}\n\n🏍️ VP Honda, Bhopal · 📞 9713394738`;
    await shareFilesAuto([{ ...doc, fileData: fileDataUrl }], msg, `${doc.docTypeLabel} - ${doc.customerName}`);
  };

  // ── Derived data ─────────────────────────────────────────────────────────────
  const filtered = view === 'all'
    ? docs.filter(d => !search || d.customerName.toLowerCase().includes(search.toLowerCase()))
    : docs.filter(d => (d.folder || folderKey(d.customerName, d.savedAt)) === activeFolder);

  const expiringSoon = docs.filter(d => d.expiryDate && checkExpiry(d.expiryDate, d.docTypeLabel)?.status !== 'ok');

  // ── RENDER ────────────────────────────────────────────────────────────────────
  if (loading) return <div style={{ padding:20, color:'#fff', textAlign:'center', background:'#020617', minHeight:'100vh' }}>☁️ Loading from MongoDB...</div>;

  if (error) return (
    <div style={{ padding:20, background:'#020617', minHeight:'100vh' }}>
      <p style={{ color:'#ef4444', fontSize:14 }}>{error}</p>
      <button onClick={loadDocuments} style={{ marginTop:10, background:'#DC0000', color:'#fff', border:'none', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
        <RefreshCw size={14} style={{ marginRight:6, verticalAlign:'middle' }}/>पुनः प्रयास
      </button>
    </div>
  );

  return (
    <div style={{ padding:14, background:'#020617', minHeight:'100vh', color:'#fff' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:800, margin:0, display:'flex', alignItems:'center', gap:8 }}>
            <FolderOpen size={20}/> Document Vault
          </h1>
          <p style={{ color:'#94a3b8', fontSize:11, margin:'3px 0 0' }}>
            {docs.length} documents · {folderList.length} customers · ☁️ MongoDB sync
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={loadDocuments} style={{ background:'#1e293b', border:'1px solid #334155', color:'#94a3b8', padding:'8px 12px', borderRadius:8, cursor:'pointer' }}>
            <RefreshCw size={14}/>
          </button>
          <button onClick={() => setShowForm(true)} style={{ background:'#DC0000', color:'#fff', border:'none', padding:'9px 16px', borderRadius:8, fontWeight:700, fontSize:12, cursor:'pointer' }}>
            + Add Document
          </button>
        </div>
      </div>

      {/* Expiry alerts */}
      {expiringSoon.length > 0 && (
        <div style={{ background:'#7c2d1222', border:'1px solid #ea580c', borderRadius:10, padding:'10px 14px', marginBottom:12 }}>
          <p style={{ color:'#fdba74', fontWeight:700, fontSize:12, margin:'0 0 5px', display:'flex', alignItems:'center', gap:5 }}>
            <AlertTriangle size={13}/> {expiringSoon.length} Documents Expire Soon!
          </p>
          {expiringSoon.map((d,i) => (
            <p key={i} style={{ color:'#fed7aa', fontSize:11, margin:'3px 0 0' }}>
              {d.docIcon} {d.customerName} · {d.docTypeLabel} · {checkExpiry(d.expiryDate, d.docTypeLabel)?.msg}
            </p>
          ))}
        </div>
      )}

      {/* Search + View Toggle */}
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setView('all'); if (!e.target.value) setView('folders'); }}
          placeholder="Customer name search..."
          style={{ flex:1, background:'#1e293b', color:'#fff', border:'1px solid #334155', borderRadius:8, padding:'9px 12px', fontSize:13, outline:'none' }}/>
        <button onClick={() => { setView('folders'); setSearch(''); setActiveFolder(null); }}
          style={{ background:view==='folders'?'#DC0000':'#1e293b', color:'#fff', border:'none', padding:'8px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>📁 Folders</button>
        <button onClick={() => setView('all')}
          style={{ background:view==='all'?'#DC0000':'#1e293b', color:'#fff', border:'none', padding:'8px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>📋 All</button>
      </div>

      {/* FOLDER LIST */}
      {view === 'folders' && !activeFolder && (
        <div>
          {folderList.length === 0 ? (
            <div style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:12, padding:40, textAlign:'center', color:'#64748b' }}>
              + Add Document से शुरू करें
            </div>
          ) : folderList.map(([key, folder]) => {
            const insCount = folder.docs.filter(d => INSURANCE_REQUIRED_KEYS.includes(d.docType)).length;
            const rtoCount = folder.docs.filter(d => RTO_REQUIRED_KEYS.includes(d.docType)).length;
            return (
              <div key={key} style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:12, padding:14, marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <div style={{ width:44, height:44, background:'#1e40af', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>📁</div>
                  <div style={{ flex:1, minWidth:140, cursor:'pointer' }} onClick={() => { setActiveFolder(key); setView('folder_detail'); }}>
                    <p style={{ fontWeight:800, fontSize:14, margin:'0 0 2px' }}>{folder.name}</p>
                    <p style={{ fontSize:11, color:'#94a3b8', margin:0 }}>📞 {folder.phone || '—'} · {folder.docs.length} docs</p>
                    {folder.nomineeName   && <p style={{ fontSize:10, color:'#c084fc', margin:'2px 0 0' }}>Nominee: {folder.nomineeName}</p>}
                    {folder.hypothecation && <p style={{ fontSize:10, color:'#fbbf24', margin:'2px 0 0' }}>Bank: {folder.hypothecation}</p>}
                    <div style={{ display:'flex', gap:3, marginTop:4, flexWrap:'wrap' }}>
                      {folder.docs.slice(0,4).map((d,i) => <span key={i} style={{ background:'#1e293b', color:'#94a3b8', padding:'1px 5px', borderRadius:3, fontSize:9 }}>{d.docIcon}</span>)}
                      {folder.docs.length > 4 && <span style={{ color:'#64748b', fontSize:9 }}>+{folder.docs.length-4}</span>}
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <button onClick={() => sendInsurance(folder.docs, folder)}
                      style={{ background:insCount>=5?'#16a34a':'#334155', color:'#fff', border:'none', padding:'7px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                      🛡️ Insurance ({insCount}/{INSURANCE_REQUIRED_KEYS.length})
                    </button>
                    <button onClick={() => sendRTO(folder.docs, folder)}
                      style={{ background:rtoCount>=6?'#7c3aed':'#334155', color:'#fff', border:'none', padding:'7px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                      🚗 RTO ({rtoCount}/{RTO_REQUIRED_KEYS.length})
                    </button>
                  </div>
                  <ChevronRight size={16} color="#475569" style={{ cursor:'pointer', flexShrink:0 }} onClick={() => { setActiveFolder(key); setView('folder_detail'); }}/>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FOLDER DETAIL */}
      {view === 'folder_detail' && activeFolder && (() => {
        const folder = folders[activeFolder]; if (!folder) return null;
        const insCount = folder.docs.filter(d => INSURANCE_REQUIRED_KEYS.includes(d.docType)).length;
        const rtoCount = folder.docs.filter(d => RTO_REQUIRED_KEYS.includes(d.docType)).length;
        return (
          <div>
            <button onClick={() => { setActiveFolder(null); setView('folders'); }}
              style={{ background:'#1e293b', border:'none', color:'#94a3b8', padding:'5px 12px', borderRadius:6, cursor:'pointer', fontSize:11, marginBottom:12 }}>
              ← सभी Folders
            </button>
            <div style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:12, padding:14, marginBottom:14 }}>
              <h2 style={{ fontSize:15, fontWeight:800, margin:'0 0 4px' }}>📁 {folder.name}</h2>
              <p style={{ color:'#94a3b8', fontSize:12, margin:'0 0 8px' }}>📞 {folder.phone||'—'} · {folder.docs.length} documents</p>
              {folder.nomineeName   && <p style={{ color:'#c084fc', fontSize:11, margin:'2px 0' }}>👤 Nominee: {folder.nomineeName}</p>}
              {folder.hypothecation && <p style={{ color:'#fbbf24', fontSize:11, margin:'2px 0' }}>🏦 Bank: {folder.hypothecation}</p>}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:12 }}>
                <button onClick={() => sendInsurance(folder.docs, folder)}
                  style={{ background:'linear-gradient(135deg,#16a34a,#15803d)', color:'#fff', border:'none', padding:12, borderRadius:10, fontWeight:800, fontSize:12, cursor:'pointer', textAlign:'left' }}>
                  <div style={{ fontSize:18, marginBottom:3 }}>🛡️</div>
                  <div>Insurance Documents</div>
                  <div style={{ fontSize:10, opacity:0.8, marginTop:2 }}>{insCount}/{INSURANCE_REQUIRED_KEYS.length} ready</div>
                  {INSURANCE_REQUIRED_KEYS.map(k => <div key={k} style={{ fontSize:9, marginTop:1 }}>{folder.docs.some(d=>d.docType===k)?'✅':'❌'} {DOC_TYPES.find(t=>t.key===k)?.label}</div>)}
                </button>
                <button onClick={() => sendRTO(folder.docs, folder)}
                  style={{ background:'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'#fff', border:'none', padding:12, borderRadius:10, fontWeight:800, fontSize:12, cursor:'pointer', textAlign:'left' }}>
                  <div style={{ fontSize:18, marginBottom:3 }}>🚗</div>
                  <div>RTO / Pal</div>
                  <div style={{ fontSize:10, opacity:0.8, marginTop:2 }}>{rtoCount}/{RTO_REQUIRED_KEYS.length} ready</div>
                  {RTO_REQUIRED_KEYS.map(k => <div key={k} style={{ fontSize:9, marginTop:1 }}>{folder.docs.some(d=>d.docType===k)?'✅':'❌'} {DOC_TYPES.find(t=>t.key===k)?.label}</div>)}
                </button>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
              {folder.docs.map(d => <DocCard key={d.id||d._id} doc={d} onView={() => openDoc(d)} onDelete={() => deleteDoc(d.id||d._id)} onShare={() => shareSingleDoc(d)}/>)}
              <div onClick={() => { setForm(f => ({...f, customerName:folder.name, customerPhone:folder.phone||'', nomineeName:folder.nomineeName||'', hypothecation:folder.hypothecation||''})); setCustSearch(folder.name); setShowForm(true); }}
                style={{ background:'#0f172a', border:'2px dashed #334155', borderRadius:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20, cursor:'pointer', gap:6, minHeight:140 }}>
                <span style={{ fontSize:24 }}>➕</span>
                <span style={{ color:'#64748b', fontSize:10, fontWeight:700 }}>Add Doc</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ALL DOCS */}
      {view === 'all' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
          {filtered.length === 0
            ? <div style={{ gridColumn:'1/-1', background:'#0f172a', border:'1px solid #1e293b', borderRadius:12, padding:30, textAlign:'center', color:'#64748b' }}>
                {search ? `"${search}" नहीं मिला` : 'कोई document नहीं'}
              </div>
            : filtered.map(d => <DocCard key={d.id||d._id} doc={d} onView={() => openDoc(d)} onDelete={() => deleteDoc(d.id||d._id)} onShare={() => shareSingleDoc(d)}/>)
          }
        </div>
      )}

      {/* Full View Modal */}
      {viewDoc && (
        <div onClick={() => { setViewDoc(null); setViewDocData(null); }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#0f172a', borderRadius:14, maxWidth:640, width:'100%', maxHeight:'94vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #1e293b', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <strong style={{ color:'#fff', fontSize:14 }}>{viewDoc.docIcon} {viewDoc.docTypeLabel}</strong>
                <p style={{ fontSize:11, color:'#94a3b8', margin:'2px 0 0' }}>{viewDoc.customerName}</p>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => shareSingleDoc(viewDoc)}
                  style={{ background:'#16a34a', color:'#fff', border:'none', padding:'6px 10px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>📱 Share</button>
                <button onClick={() => { setViewDoc(null); setViewDocData(null); }}
                  style={{ background:'#475569', color:'#fff', border:'none', padding:'6px 10px', borderRadius:6, cursor:'pointer' }}><X size={14}/></button>
              </div>
            </div>
            <div style={{ flex:1, overflow:'auto', background:'#000', display:'flex', alignItems:'center', justifyContent:'center', minHeight:200 }}>
              {!viewDocData ? (
                <p style={{ color:'#64748b', fontSize:13 }}>⏳ Loading...</p>
              ) : viewDoc.fileType === 'image' ? (
                <img src={viewDocData} alt={viewDoc.docTypeLabel} style={{ maxWidth:'100%', maxHeight:'80vh' }}/>
              ) : viewDoc.fileType === 'pdf' ? (
                <iframe src={viewDocData} style={{ width:'100%', height:'80vh', border:'none' }} title="PDF"/>
              ) : viewDoc.fileType === 'video' ? (
                <video src={viewDocData} controls style={{ width:'100%', maxHeight:'80vh' }}/>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Add Document Modal */}
      {showForm && (
        <div onClick={() => { setShowForm(false); setFileData(null); }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:14, width:'100%', maxWidth:500, maxHeight:'94vh', overflowY:'auto', padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
              <h2 style={{ fontSize:15, fontWeight:800, margin:0 }}>📄 नया Document</h2>
              <button onClick={() => { setShowForm(false); setFileData(null); }} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div style={{ display:'grid', gap:10 }}>
              {/* Customer Name with Dropdown */}
              <div ref={dropdownRef} style={{ position:'relative' }}>
                <label style={lbl}>Customer Name *</label>
                <input value={custSearch} onChange={e => handleCustNameChange(e.target.value)}
                  placeholder="नाम — auto-fill होगा" style={inp} autoComplete="off"/>
                {showDropdown && filteredCustomers.length > 0 && (
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#1e293b', border:'1px solid #475569', borderRadius:8, maxHeight:200, overflowY:'auto', zIndex:60 }}>
                    {filteredCustomers.map((c, i) => (
                      <div key={i} onClick={() => selectCustomer(c)}
                        style={{ padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid #334155' }}
                        onMouseEnter={e => e.currentTarget.style.background='#334155'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <strong style={{ color:'#fff', fontSize:12 }}>{c.customerName || c.name}</strong>
                        <br/><span style={{ fontSize:10, color:'#94a3b8' }}>📞 {c.mobileNo || c.phone} · 🪪 {c.aadhar || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div><label style={lbl}>Mobile Number</label><input value={form.customerPhone} onChange={e => setForm({...form, customerPhone: e.target.value.replace(/\D/g,'')})} maxLength={10} placeholder="10-digit" style={inp}/></div>
              <div><label style={lbl}>Aadhar Number</label><input value={form.aadharNo} onChange={e => setForm({...form, aadharNo: e.target.value.replace(/\D/g,'').slice(0,12)})} maxLength={12} placeholder="12-digit" style={inp}/></div>
              <div><label style={lbl}>Nominee Name</label><input value={form.nomineeName} onChange={e => setForm({...form, nomineeName: e.target.value})} placeholder="जैसे: Sita Devi" style={inp}/></div>
              <div><label style={lbl}>Hypothecation (Bank/Financer)</label><input value={form.hypothecation} onChange={e => setForm({...form, hypothecation: e.target.value})} placeholder="जैसे: HDFC Bank" style={inp}/></div>
              <div><label style={lbl}>Vehicle Model</label><input value={form.vehicleModel} onChange={e => setForm({...form, vehicleModel: e.target.value})} placeholder="SP125, Activa" style={inp}/></div>
              <div><label style={lbl}>Chassis No</label><input value={form.chassisNo} onChange={e => setForm({...form, chassisNo: e.target.value.toUpperCase()})} placeholder="ME4JC94FDTG104998" style={inp}/></div>
              <div><label style={lbl}>Document Type *</label>
                <select value={form.docType} onChange={e => setForm({...form, docType: e.target.value})} style={inp}>
                  {DOC_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
                </select>
              </div>
              {DOC_TYPES.find(t => t.key === form.docType)?.hasExpiry && (
                <div><label style={lbl}>Expiry Date</label><input type="date" value={form.expiryDate} onChange={e => setForm({...form, expiryDate: e.target.value})} style={inp}/></div>
              )}
              <div><label style={lbl}>Notes</label><input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Optional" style={inp}/></div>
              {/* File Upload */}
              <div>
                <label style={lbl}>📎 File Upload * (Auto-compressed ✅)</label>
                {fileData ? (
                  <div style={{ background:'#1e293b', borderRadius:8, padding:'10px 12px' }}>
                    {/* File info row */}
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:20, flexShrink:0 }}>
                        {fileData.fileType==='pdf' ? '📄' : fileData.fileType==='video' ? '🎥' : '🖼️'}
                      </span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontWeight:700, fontSize:12, margin:0, color:'#fff', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                          {fileData.fileName}
                        </p>
                        {/* Compression status */}
                        {fileData.fileType === 'image' && (
                          fileData.compFailed
                            ? <p style={{ fontSize:10, margin:'3px 0 0', color:'#fbbf24' }}>
                                ⚠️ Compress failed · Original: {fileData.sizeKB} KB (Upload होगी)
                              </p>
                            : <p style={{ fontSize:10, margin:'3px 0 0', color:'#86efac' }}>
                                ✅ {fileData.origKB}KB → {fileData.sizeKB}KB compressed
                              </p>
                        )}
                        {fileData.fileType !== 'image' && (
                          <p style={{ fontSize:10, margin:'3px 0 0', color:'#94a3b8' }}>{fileData.sizeKB} KB</p>
                        )}
                      </div>
                      <button onClick={() => setFileData(null)}
                        style={{ background:'#dc2626', border:'none', color:'#fff', borderRadius:'50%', width:24, height:24, cursor:'pointer', fontWeight:700, fontSize:14, lineHeight:'24px', textAlign:'center', flexShrink:0 }}>
                        ×
                      </button>
                    </div>

                    {/* Retry compression — shown only if failed */}
                    {fileData.compFailed && fileData.fileType === 'image' && (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:8 }}>
                        <button onClick={async () => {
                          showInAppToast('⏳', 'Method 2 try हो रहा है...', 'info');
                          const r = await compressImageRobust(fileData.dataUrl, 1000, 0.70);
                          if (!r.failed) {
                            setFileData(p => ({ ...p, dataUrl: r.dataUrl, sizeKB: r.sizeKB, compFailed: false, compMethod: r.method }));
                            showInAppToast('✅ Compressed!', `${r.origKB}KB → ${r.sizeKB}KB`, 'success');
                          } else showInAppToast('❌', 'Method 2 भी failed', 'error');
                        }} style={{ background:'#d97706', border:'none', color:'#fff', borderRadius:6, padding:'8px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                          🔄 Retry (Medium)
                        </button>
                        <button onClick={async () => {
                          showInAppToast('⏳', 'Low quality try हो रहा है...', 'info');
                          const r = await compressImageRobust(fileData.dataUrl, 800, 0.50);
                          if (!r.failed) {
                            setFileData(p => ({ ...p, dataUrl: r.dataUrl, sizeKB: r.sizeKB, compFailed: false, compMethod: r.method }));
                            showInAppToast('✅ Compressed (low)!', `${r.origKB}KB → ${r.sizeKB}KB`, 'success');
                          } else showInAppToast('⚠️', 'Original photo use होगी', 'warning');
                        }} style={{ background:'#854d0e', border:'none', color:'#fff', borderRadius:6, padding:'8px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                          🔄 Retry (Low)
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <button onClick={capturePhoto} disabled={capturing}
                      style={{ background:'#1e3a8a', border:'2px dashed #3b82f6', color:'#fff', padding:'14px 10px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', textAlign:'center' }}>
                      <Camera size={20} style={{ display:'block', margin:'0 auto 4px' }}/>{capturing ? '...' : '📷 Camera'}
                    </button>
                    <button onClick={pickFromGallery}
                      style={{ background:'#1a1a2e', border:'2px dashed #a855f7', color:'#fff', padding:'14px 10px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', textAlign:'center' }}>
                      <Image size={20} style={{ display:'block', margin:'0 auto 4px' }}/>🖼️ Gallery
                    </button>
                    <button onClick={pickPDF}
                      style={{ background:'#431407', border:'2px dashed #ea580c', color:'#fff', padding:'14px 10px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', textAlign:'center' }}>
                      <FileText size={20} style={{ display:'block', margin:'0 auto 4px' }}/>📄 PDF
                    </button>
                    <button onClick={pickVideo}
                      style={{ background:'#2e1065', border:'2px dashed #7c3aed', color:'#fff', padding:'14px 10px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', textAlign:'center' }}>
                      <Video size={20} style={{ display:'block', margin:'0 auto 4px' }}/>🎥 Video
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              <button onClick={() => saveDoc(true)} disabled={!fileData || saving}
                style={{ flex:1, background:fileData&&!saving?'#2563eb':'#475569', color:'#fff', border:'none', padding:12, borderRadius:10, fontWeight:700, cursor:fileData&&!saving?'pointer':'not-allowed', fontSize:12 }}>
                ➕ Save & Add Another
              </button>
              <button onClick={() => saveDoc(false)} disabled={!fileData || saving}
                style={{ flex:1, background:fileData&&!saving?'#DC0000':'#475569', color:'#fff', border:'none', padding:12, borderRadius:10, fontWeight:800, cursor:fileData&&!saving?'pointer':'not-allowed', fontSize:12 }}>
                {saving ? '⏳ Saving...' : '💾 Save & Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Doc Card Component ────────────────────────────────────────────────────────
function DocCard({ doc, onView, onDelete, onShare }) {
  let icon = <Image size={28} color="#94a3b8"/>;
  if (doc.fileType === 'pdf')   icon = <FileText size={28} color="#ea580c"/>;
  if (doc.fileType === 'video') icon = <Video size={28} color="#7c3aed"/>;

  return (
    <div style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:10, overflow:'hidden' }}>
      <div onClick={onView} style={{ cursor:'pointer', height:100, background:'#1e293b', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:4 }}>
        {icon}
        <span style={{ fontSize:18 }}>{doc.docIcon}</span>
      </div>
      <div style={{ padding:'8px 10px' }}>
        <p style={{ fontWeight:700, fontSize:11, margin:'0 0 2px', color:'#fff', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{doc.customerName}</p>
        <p style={{ color:'#64748b', fontSize:9, margin:'0 0 1px' }}>{doc.docTypeLabel}</p>
        <p style={{ color:'#475569', fontSize:9, margin:0 }}>{new Date(doc.savedAt).toLocaleDateString('en-IN')}</p>
        <div style={{ display:'flex', gap:4, marginTop:6 }}>
          <button onClick={onView} style={{ flex:1, background:'#1e40af', color:'#fff', border:'none', padding:'4px', borderRadius:4, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Eye size={11}/></button>
          <button onClick={onShare} style={{ flex:1, background:'#16a34a', color:'#fff', border:'none', padding:'4px', borderRadius:4, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Share2 size={11}/></button>
          <button onClick={onDelete} style={{ background:'#7f1d1d', color:'#fff', border:'none', padding:'4px 6px', borderRadius:4, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Trash2 size={11}/></button>
        </div>
      </div>
    </div>
  );
}

const lbl = { color:'#94a3b8', fontSize:11, fontWeight:700, marginBottom:4, display:'block' };
const inp = { background:'#1e293b', color:'#fff', border:'1px solid #475569', borderRadius:8, padding:'9px 12px', fontSize:13, width:'100%', outline:'none', boxSizing:'border-box' };
