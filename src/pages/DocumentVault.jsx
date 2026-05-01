// DocumentVault.jsx — VP Honda (Hypothecation + Insurance/RTO fixed + Mobile share fallback)
import { useState, useEffect, useRef } from 'react';
import { FolderOpen, Camera, X, AlertTriangle, Search, Image, ChevronRight, FileText, Video, Share2, Trash2, Eye } from 'lucide-react';
import { captureFromCamera, checkExpiry, showInAppToast } from '../utils/smartUtils';
import { api, apiFetch } from '../utils/apiConfig';

const DOC_TYPES = [
  { key: 'aadhar', label: 'Aadhar Card', icon: '🪪', hasExpiry: false },
  { key: 'pan', label: 'PAN Card', icon: '💳', hasExpiry: false },
  { key: 'chassis_trace', label: 'Chassis Trace Page', icon: '📋', hasExpiry: false },
  { key: 'vp_tax_invoice', label: 'VP Tax Invoice', icon: '🧾', hasExpiry: false },
  { key: 'su_tax_invoice', label: 'SU Tax Invoice', icon: '🧾', hasExpiry: false },
  { key: 'challan', label: 'Challan', icon: '📜', hasExpiry: false },
  { key: 'chassis_photo', label: 'Chassis Photo', icon: '🔢', hasExpiry: false },
  { key: 'chassis_video', label: 'Chassis Video', icon: '🎥', hasExpiry: false },
  { key: 'delivery_photo', label: 'Delivery Photo', icon: '📸', hasExpiry: false },
  { key: 'old_rc', label: 'Old RC Card', icon: '🪪', hasExpiry: false },
  { key: 'old_noc', label: 'Old Bike NOC', icon: '📑', hasExpiry: false },
  { key: 'rto_form', label: 'RTO Form', icon: '🚗', hasExpiry: false },
  { key: 'rc', label: 'RC Book', icon: '📄', hasExpiry: false },
  { key: 'insurance', label: 'Insurance Policy', icon: '🛡️', hasExpiry: true },
  { key: 'puc', label: 'PUC Certificate', icon: '🔬', hasExpiry: true },
  { key: 'other', label: 'Other Document', icon: '📁', hasExpiry: false },
];

// Insurance के लिए चाहिए: VP Tax Invoice, Aadhar, PAN, Challan, Chassis Trace
const INSURANCE_REQUIRED_KEYS = ['vp_tax_invoice', 'aadhar', 'pan', 'challan', 'chassis_trace'];
// RTO के लिए चाहिए: SU Tax Invoice, Insurance, Aadhar, PAN, Chassis Trace, Chassis Photo
const RTO_REQUIRED_KEYS = ['su_tax_invoice', 'insurance', 'aadhar', 'pan', 'chassis_trace', 'chassis_photo'];

const folderKey = (name, date) => {
  const d = date ? new Date(date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' }) : new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' });
  return `${(name || 'Unknown').replace(/\s+/g, '_')}_${d}`;
};

// Image compression
async function compressImageRobust(dataUrl, maxWidth = 1200, quality = 0.8) {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    let width = bitmap.width, height = bitmap.height;
    if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const compressed = canvas.toDataURL('image/jpeg', quality);
    bitmap.close();
    return compressed;
  } catch (err) { return dataUrl; }
}

async function processFile(file, type) {
  return new Promise((resolve, reject) => {
    if (file.size > 30 * 1024 * 1024) { alert('फाइल 30MB से छोटी चाहिए'); reject(); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      let dataUrl = e.target.result;
      if (type === 'image') dataUrl = await compressImageRobust(dataUrl);
      resolve({ dataUrl, fileType: type, fileName: file.name });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataURLtoFile(dataURL, fileName, mimeType) {
  const arr = dataURL.split(',');
  const mime = mimeType || (arr[0].match(/:(.*?);/)[1]);
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], fileName, { type: mime });
}

// Check if multi-file share is supported
function canShareMultipleFiles(files) {
  return navigator.canShare && navigator.canShare({ files: files });
}

// Share multiple files (if supported) otherwise share one by one
async function shareFilesAuto(files, text, title) {
  if (!navigator.share) {
    alert('आपका ब्राउज़र शेयर सुविधा सपोर्ट नहीं करता।');
    return false;
  }
  // Try multi-file share first
  if (canShareMultipleFiles(files)) {
    try {
      await navigator.share({ title, text, files });
      return true;
    } catch (err) {
      if (err.name !== 'AbortError') console.warn('Multi share failed', err);
    }
  }
  // Fallback: share one by one
  for (let i = 0; i < files.length; i++) {
    try {
      await navigator.share({
        title: `${title} - ${files[i].name}`,
        text: i === 0 ? text : `${text}\n(File ${i+1}/${files.length})`,
        files: [files[i]]
      });
      // थोड़ा अंतराल ताकि व्हाट्सएप बंद न हो
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      if (err.name !== 'AbortError') alert(`${files[i].name} शेयर नहीं हुआ: ${err.message}`);
    }
  }
  return true;
}

export default function DocumentVault() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', aadharNo: '', vehicleModel: '', chassisNo: '',
    nomineeName: '', hypothecation: '', docType: 'aadhar', expiryDate: '', notes: ''
  });
  const [fileData, setFileData] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [viewDoc, setViewDoc] = useState(null);
  const [activeFolder, setActiveFolder] = useState(null);
  const [view, setView] = useState('folders');
  const [customers, setCustomers] = useState([]);
  const [custSearch, setCustSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/documents');
      setDocs(data);
    } catch (err) { setError('❌ सर्वर कनेक्ट नहीं हुआ'); }
    setLoading(false);
  };

  const saveDoc = async (stayOpen = false) => {
    if (!form.customerName || !fileData) { alert('कृपया नाम और फाइल चुनें'); return; }
    const docType = DOC_TYPES.find(d => d.key === form.docType) || DOC_TYPES[0];
    const now = new Date().toISOString();
    const newDoc = {
      folder: folderKey(form.customerName, now),
      customerName: form.customerName, customerPhone: form.customerPhone, aadharNo: form.aadharNo,
      vehicleModel: form.vehicleModel, chassisNo: form.chassisNo,
      nomineeName: form.nomineeName, hypothecation: form.hypothecation,
      docType: form.docType, docTypeLabel: docType.label, docIcon: docType.icon,
      expiryDate: form.expiryDate, notes: form.notes,
      fileData: fileData.dataUrl, fileType: fileData.fileType, fileName: fileData.fileName,
      savedAt: now,
    };
    try {
      const saved = await apiFetch('/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newDoc) });
      setDocs(prev => [saved, ...prev]);
      showInAppToast('☁️ सेव हुआ', docType.label, 'success');
      if (!stayOpen) {
        setShowForm(false); setFileData(null);
        setForm({ customerName: '', customerPhone: '', aadharNo: '', vehicleModel: '', chassisNo: '', nomineeName: '', hypothecation: '', docType: 'aadhar', expiryDate: '', notes: '' });
        setCustSearch('');
      } else {
        setFileData(null);
        setForm({ ...form, docType: 'aadhar', expiryDate: '', notes: '' });
      }
    } catch (err) { alert('सेव नहीं हुआ'); }
  };

  const deleteDoc = async (id) => {
    if (!id || !window.confirm('डिलीट करें?')) return;
    try {
      await apiFetch(`/api/documents/${id}`, { method: 'DELETE' });
      setDocs(prev => prev.filter(d => d.id !== id && d._id !== id));
      showInAppToast('🗑️ डिलीट', '', 'success');
    } catch (err) { alert('डिलीट नहीं हुआ'); }
  };

  // File pickers
  const capturePhoto = async () => {
    setCapturing(true);
    try { const raw = await captureFromCamera('environment'); const comp = await compressImageRobust(raw); setFileData({ dataUrl: comp, fileType: 'image', fileName: 'camera_photo.jpg' }); }
    catch (e) { showInAppToast('❌ कैमरा एरर', String(e), 'error'); }
    setCapturing(false);
  };
  const pickFromGallery = async () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/jpg';
    input.onchange = async (e) => { const file = e.target.files?.[0]; if (file) setFileData(await processFile(file, 'image')); };
    input.click();
  };
  const pickPDF = async () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/pdf';
    input.onchange = async (e) => { const file = e.target.files?.[0]; if (file) setFileData(await processFile(file, 'pdf')); };
    input.click();
  };
  const pickVideo = async () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'video/mp4,video/quicktime';
    input.onchange = async (e) => { const file = e.target.files?.[0]; if (file) setFileData(await processFile(file, 'video')); };
    input.click();
  };

  useEffect(() => {
    fetch(api('/api/customers')).then(r => r.ok ? r.json() : []).then(setCustomers).catch(() => {});
    loadDocuments();
  }, []);

  // Customer dropdown
  const filteredCustomers = custSearch.trim().length >= 2 ? customers.filter(c => (c.customerName || c.name || '').toLowerCase().includes(custSearch.toLowerCase()) || (c.mobileNo || c.phone || '').includes(custSearch) || (c.aadhar || '').includes(custSearch)).slice(0, 8) : [];
  const selectCustomer = (cust) => {
    setForm({ ...form, customerName: cust.customerName || cust.name || '', customerPhone: cust.mobileNo || cust.phone || '', aadharNo: cust.aadhar || '', vehicleModel: cust.vehicleModel || '', chassisNo: cust.chassisNo || '' });
    setCustSearch(cust.customerName || cust.name || ''); setShowDropdown(false);
  };
  const handleCustNameChange = (value) => { setCustSearch(value); setForm({ ...form, customerName: value }); setShowDropdown(value.trim().length >= 2); };
  useEffect(() => { const handleClickOutside = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false); }; document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside); }, []);

  // Folders
  const folders = docs.reduce((acc, d) => {
    const key = d.folder || folderKey(d.customerName, d.savedAt);
    if (!acc[key]) acc[key] = { name: d.customerName, phone: d.customerPhone, docs: [], date: d.savedAt, nomineeName: d.nomineeName, hypothecation: d.hypothecation };
    acc[key].docs.push(d);
    if (d.nomineeName) acc[key].nomineeName = d.nomineeName;
    if (d.hypothecation) acc[key].hypothecation = d.hypothecation;
    return acc;
  }, {});
  const folderList = Object.entries(folders).sort((a,b) => new Date(b[1].date) - new Date(a[1].date));

  // Insurance share
  const sendInsurance = async (folderDocs, folder) => {
    const available = folderDocs.filter(d => INSURANCE_REQUIRED_KEYS.includes(d.docType));
    if (available.length === 0) { alert('कोई आवश्यक डॉक्यूमेंट नहीं'); return; }
    const nominee = folder.nomineeName || '—';
    const hypothec = folder.hypothecation || '—';
    const textMsg = `🛡️ *VP Honda — Insurance Documents*\n👤 ${folder.name}\n📞 ${folder.phone}\n👥 Nominee: ${nominee}\n🏦 Hypothecation: ${hypothec}\n📎 ${available.map(d=>d.docTypeLabel).join(', ')}`;
    const files = available.map(d => dataURLtoFile(d.fileData, `${folder.name}_${d.docTypeLabel}.${d.fileType==='image'?'jpg':d.fileType==='pdf'?'pdf':'mp4'}`, d.fileType==='image'?'image/jpeg':d.fileType==='pdf'?'application/pdf':'video/mp4'));
    await shareFilesAuto(files, textMsg, `Insurance - ${folder.name}`);
  };

  // RTO share
  const sendRTO = async (folderDocs, folder) => {
    const available = folderDocs.filter(d => RTO_REQUIRED_KEYS.includes(d.docType));
    if (available.length === 0) { alert('कोई आवश्यक डॉक्यूमेंट नहीं'); return; }
    const first = folderDocs[0];
    const textMsg = `🚗 *VP Honda — RTO Documents*\n👤 ${folder.name}\n📞 ${folder.phone}\n🏍️ ${first?.vehicleModel || ''}\n🔢 ${first?.chassisNo || ''}\n📎 ${available.map(d=>d.docTypeLabel).join(', ')}`;
    const files = available.map(d => dataURLtoFile(d.fileData, `${folder.name}_${d.docTypeLabel}.${d.fileType==='image'?'jpg':d.fileType==='pdf'?'pdf':'mp4'}`, d.fileType==='image'?'image/jpeg':d.fileType==='pdf'?'application/pdf':'video/mp4'));
    await shareFilesAuto(files, textMsg, `RTO - ${folder.name}`);
  };

  // Single document share (same fallback logic)
  const shareSingleDoc = async (doc) => {
    const textMsg = `📄 *VP Honda Document*\n👤 ${doc.customerName}\n📂 ${doc.docTypeLabel}\n📅 ${new Date(doc.savedAt).toLocaleDateString('en-IN')}`;
    const ext = doc.fileType === 'image' ? 'jpg' : (doc.fileType === 'pdf' ? 'pdf' : 'mp4');
    const file = dataURLtoFile(doc.fileData, `${doc.customerName}_${doc.docTypeLabel}.${ext}`, doc.fileType==='image'?'image/jpeg':doc.fileType==='pdf'?'application/pdf':'video/mp4');
    await shareFilesAuto([file], textMsg, `${doc.docTypeLabel} - ${doc.customerName}`);
  };

  const filtered = view === 'all' ? docs.filter(d => !search || d.customerName.toLowerCase().includes(search.toLowerCase())) : docs.filter(d => (d.folder || folderKey(d.customerName, d.savedAt)) === activeFolder);
  const expiringSoon = docs.filter(d => d.expiryDate && checkExpiry(d.expiryDate, d.docTypeLabel)?.status !== 'ok');

  if (loading) return <div style={{ padding: 20, color: 'white', textAlign: 'center' }}>☁️ लोड हो रहा...</div>;
  if (error) return <div style={{ padding: 20, color: '#ef4444' }}>{error}<br /><button onClick={loadDocuments} style={{ marginTop: 10, background: '#DC0000', padding: '8px 16px', borderRadius: 8 }}>पुनः प्रयास</button></div>;

  return (
    <div style={{ padding: 14, background: '#020617', minHeight: '100vh', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div><h1 style={{ fontSize: 20 }}><FolderOpen size={20} /> Document Vault</h1><p>{docs.length} docs · {folderList.length} folders · 📱 शेयर के लिए मोबाइल ब्राउज़र</p></div>
        <button onClick={() => setShowForm(true)} style={{ background: '#DC0000', padding: '10px 16px', borderRadius: 10 }}>+ Add Document</button>
      </div>
      {expiringSoon.length > 0 && <div style={{ background: '#7c2d1222', border: '1px solid #ea580c', borderRadius: 10, padding: 10, marginBottom: 12 }}>{expiringSoon.map((d,i)=> <p key={i}>{d.docIcon} {d.customerName} · {d.docTypeLabel} · {checkExpiry(d.expiryDate, d.docTypeLabel)?.msg}</p>)}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={search} onChange={e=>{ setSearch(e.target.value); setView('all'); if(!e.target.value) setView('folders'); }} placeholder="खोजें..." style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, padding: 10, width: '100%', color: '#fff' }} />
        <button onClick={()=>{ setView('folders'); setSearch(''); setActiveFolder(null); }} style={{ background: view==='folders'?'#DC0000':'#1e293b', padding:'8px 14px', borderRadius:8 }}>📁 Folders</button>
        <button onClick={()=>setView('all')} style={{ background: view==='all'?'#DC0000':'#1e293b', padding:'8px 14px', borderRadius:8 }}>📋 All Docs</button>
      </div>

      {view === 'folders' && !activeFolder && folderList.map(([key,folder]) => {
        const insCount = folder.docs.filter(d=>INSURANCE_REQUIRED_KEYS.includes(d.docType)).length;
        const rtoCount = folder.docs.filter(d=>RTO_REQUIRED_KEYS.includes(d.docType)).length;
        return (
          <div key={key} style={{ background: '#0f172a', borderRadius: 12, padding: 14, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 44, height: 44, background: '#1e40af', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📁</div>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={()=>{ setActiveFolder(key); setView('folder_detail'); }}>
                <p style={{ fontWeight: 800 }}>{folder.name}</p>
                <p style={{ fontSize: 11, color: '#94a3b8' }}>📞 {folder.phone} · {folder.docs.length} docs</p>
                {folder.nomineeName && <p style={{ fontSize: 10, color: '#c084fc' }}>Nominee: {folder.nomineeName}</p>}
                {folder.hypothecation && <p style={{ fontSize: 10, color: '#fbbf24' }}>Hypothecation: {folder.hypothecation}</p>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={()=>sendInsurance(folder.docs, folder)} style={{ background: insCount>=5?'#16a34a':'#334155', padding:'7px 12px', borderRadius:8, fontSize:11 }}>🛡️ Insurance ({insCount}/{INSURANCE_REQUIRED_KEYS.length})</button>
                <button onClick={()=>sendRTO(folder.docs, folder)} style={{ background: rtoCount>=6?'#7c3aed':'#334155', padding:'7px 12px', borderRadius:8, fontSize:11 }}>🚗 RTO ({rtoCount}/{RTO_REQUIRED_KEYS.length})</button>
              </div>
              <ChevronRight size={16} color="#64748b" style={{ cursor:'pointer' }} onClick={()=>{ setActiveFolder(key); setView('folder_detail'); }} />
            </div>
          </div>
        );
      })}

      {view === 'folder_detail' && activeFolder && (()=>{ const folder = folders[activeFolder]; if(!folder) return null; return (
        <div><button onClick={()=>{ setActiveFolder(null); setView('folders'); }} style={{ background:'#1e293b', border:'none', padding:'4px 10px', borderRadius:6, marginBottom:10 }}>← सभी फोल्डर</button>
        <div style={{ background:'#0f172a', borderRadius:12, padding:14, marginBottom:14 }}>
          <h2>{folder.name}</h2><p>📞 {folder.phone} · {folder.docs.length} docs</p>
          {folder.nomineeName && <p>Nominee: {folder.nomineeName}</p>}
          {folder.hypothecation && <p>Hypothecation: {folder.hypothecation}</p>}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10 }}>
          {folder.docs.map(d=> <DocCard key={d.id||d._id} doc={d} onView={()=>setViewDoc(d)} onDelete={()=>deleteDoc(d.id||d._id)} onShare={()=>shareSingleDoc(d)} />)}
          <div onClick={()=>{ setForm({ ...form, customerName: folder.name, customerPhone: folder.phone||'', nomineeName: folder.nomineeName||'', hypothecation: folder.hypothecation||'' }); setCustSearch(folder.name); setShowForm(true); }} style={{ background:'#0f172a', border:'2px dashed #334155', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', padding:20, cursor:'pointer' }}>➕ Add Document</div>
        </div></div>
      )})()}

      {view === 'all' && <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10 }}>{filtered.map(d=> <DocCard key={d.id||d._id} doc={d} onView={()=>setViewDoc(d)} onDelete={()=>deleteDoc(d.id||d._id)} onShare={()=>shareSingleDoc(d)} />)}</div>}
      {viewDoc && <FullViewModal doc={viewDoc} onClose={()=>setViewDoc(null)} />}
      {showForm && (
        <div onClick={()=>{ setShowForm(false); setFileData(null); }} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#0f172a', borderRadius:14, width:'100%', maxWidth:500, padding:20, maxHeight:'94vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}><h2>📄 नया डॉक्यूमेंट</h2><button onClick={()=>{ setShowForm(false); setFileData(null); }}><X size={18}/></button></div>
            <div style={{ display:'grid', gap:10 }}>
              <div ref={dropdownRef} style={{ position:'relative' }}><label style={lbl}>Customer Name *</label><input value={custSearch} onChange={e=>handleCustNameChange(e.target.value)} placeholder="नाम" style={inp} autoComplete="off"/>
              {showDropdown && filteredCustomers.length>0 && <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#1e293b', border:'1px solid #475569', borderRadius:8, maxHeight:200, overflowY:'auto', zIndex:60 }}>{filteredCustomers.map((c,i)=><div key={i} onClick={()=>selectCustomer(c)} style={{ padding:'8px 12px', cursor:'pointer' }}><strong>{c.customerName||c.name}</strong><br/><span style={{ fontSize:11 }}>📞 {c.mobileNo||c.phone} · 🪪 {c.aadhar||'—'}</span></div>)}</div>}</div>
              <div><label style={lbl}>Mobile Number</label><input value={form.customerPhone} onChange={e=>setForm({...form, customerPhone: e.target.value.replace(/\D/g,'')})} maxLength={10} style={inp}/></div>
              <div><label style={lbl}>Aadhar Number</label><input value={form.aadharNo} onChange={e=>setForm({...form, aadharNo: e.target.value.replace(/\D/g,'').slice(0,12)})} maxLength={12} style={inp}/></div>
              <div><label style={lbl}>Nominee Name</label><input value={form.nomineeName} onChange={e=>setForm({...form, nomineeName: e.target.value})} placeholder="जैसे: Sita Devi" style={inp}/></div>
              <div><label style={lbl}>Hypothecation (बैंक / फाइनेंसर)</label><input value={form.hypothecation} onChange={e=>setForm({...form, hypothecation: e.target.value})} placeholder="जैसे: HDFC Bank" style={inp}/></div>
              <div><label style={lbl}>Vehicle Model</label><input value={form.vehicleModel} onChange={e=>setForm({...form, vehicleModel: e.target.value})} placeholder="SP125" style={inp}/></div>
              <div><label style={lbl}>Chassis No</label><input value={form.chassisNo} onChange={e=>setForm({...form, chassisNo: e.target.value.toUpperCase()})} placeholder="ME4JC94FDTG104998" style={inp}/></div>
              <div><label style={lbl}>Document Type</label><select value={form.docType} onChange={e=>setForm({...form, docType: e.target.value})} style={inp}>{DOC_TYPES.map(t=><option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}</select></div>
              {DOC_TYPES.find(t=>t.key===form.docType)?.hasExpiry && <div><label style={lbl}>Expiry Date</label><input type="date" value={form.expiryDate} onChange={e=>setForm({...form, expiryDate: e.target.value})} style={inp}/></div>}
              <div><label style={lbl}>Notes</label><input value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} placeholder="Optional" style={inp}/></div>
              <div><label style={lbl}>📎 फाइल अपलोड करें *</label>
                {fileData ? <div style={{ position:'relative', background:'#1e293b', borderRadius:8, padding:8 }}><p style={{ margin:0 }}>✅ {fileData.fileName}</p><button onClick={()=>setFileData(null)} style={{ position:'absolute', top:4, right:4, background:'#dc2626', border:'none', borderRadius:'50%', width:24, height:24 }}>×</button></div>
                : <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}><button onClick={capturePhoto} disabled={capturing} style={{ background:'#1e3a8a', padding:12, borderRadius:8 }}><Camera size={18}/> कैमरा</button><button onClick={pickFromGallery} style={{ background:'#1a1a2e', padding:12, borderRadius:8 }}><Image size={18}/> गैलरी</button><button onClick={pickPDF} style={{ background:'#854d0e', padding:12, borderRadius:8 }}><FileText size={18}/> PDF</button><button onClick={pickVideo} style={{ background:'#4c1d95', padding:12, borderRadius:8 }}><Video size={18}/> वीडियो</button></div>}
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:14 }}><button onClick={()=>saveDoc(true)} disabled={!fileData} style={{ flex:1, background:fileData?'#2563eb':'#475569', padding:12, borderRadius:10 }}>➕ Save & Add Another</button><button onClick={()=>saveDoc(false)} disabled={!fileData} style={{ flex:1, background:fileData?'#DC0000':'#475569', padding:12, borderRadius:10 }}>💾 Save & Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocCard({ doc, onView, onDelete, onShare }) {
  let icon = <Image size={24}/>; if(doc.fileType==='pdf') icon=<FileText size={24}/>; if(doc.fileType==='video') icon=<Video size={24}/>;
  return (
    <div style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:10, overflow:'hidden' }}>
      <div onClick={onView} style={{ cursor:'pointer', height:120, background:'#1e293b', display:'flex', alignItems:'center', justifyContent:'center' }}>{icon}</div>
      <div style={{ padding:8 }}><p style={{ fontWeight:700, fontSize:11 }}>{doc.customerName}</p><p style={{ color:'#64748b', fontSize:9, margin:'2px 0' }}>{doc.docTypeLabel}</p><p style={{ color:'#64748b', fontSize:9 }}>{new Date(doc.savedAt).toLocaleDateString('en-IN')}</p>
        <div style={{ display:'flex', gap:4, marginTop:8 }}><button onClick={onView} style={{ flex:1, background:'#1e40af', padding:'4px', borderRadius:4, fontSize:9 }}><Eye size={12}/> देखें</button><button onClick={onShare} style={{ flex:1, background:'#25D366', padding:'4px', borderRadius:4, fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', gap:2 }}><Share2 size={12}/> शेयर</button><button onClick={onDelete} style={{ background:'#7f1d1d', padding:'4px', borderRadius:4, fontSize:9 }}><Trash2 size={12}/></button></div>
      </div>
    </div>
  );
}

function FullViewModal({ doc, onClose }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#0f172a', borderRadius:14, maxWidth:640, width:'100%', maxHeight:'94vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #1e293b', display:'flex', justifyContent:'space-between' }}><div><strong>{doc.docIcon} {doc.docTypeLabel}</strong><br/><span style={{ fontSize:11 }}>{doc.customerName}</span></div><button onClick={onClose}><X size={18}/></button></div>
        <div style={{ flex:1, overflow:'auto', textAlign:'center', padding:10 }}>
          {doc.fileType === 'image' && <img src={doc.fileData} alt="doc" style={{ maxWidth:'100%' }} />}
          {doc.fileType === 'pdf' && <iframe src={doc.fileData} style={{ width:'100%', height:'80vh' }} title="PDF" />}
          {doc.fileType === 'video' && <video src={doc.fileData} controls style={{ width:'100%', maxHeight:'80vh' }} />}
        </div>
      </div>
    </div>
  );
}

const lbl = { color:'#94a3b8', fontSize:11, fontWeight:700, marginBottom:4, display:'block' };
const inp = { background:'#1e293b', color:'#fff', border:'1px solid #475569', borderRadius:8, padding:'10px 12px', fontSize:13, width:'100%', outline:'none' };
