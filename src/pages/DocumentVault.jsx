// DocumentVault.jsx — VP Honda (Fixed delete, visible doc names, individual WhatsApp share)
import { useState, useEffect, useRef } from 'react';
import { FolderOpen, Camera, X, AlertTriangle, Search, Image, ChevronRight, FileText, Video, Share2, Trash2, Eye } from 'lucide-react';
import { captureFromCamera, checkExpiry, showInAppToast, sendWhatsApp } from '../utils/smartUtils';
import { api, apiFetch } from '../utils/apiConfig';

// Document types (same as before)
const DOC_TYPES = [
  { key: 'aadhar', label: 'Aadhar Card', icon: '🪪', hasExpiry: false },
  { key: 'pan', label: 'PAN Card', icon: '💳', hasExpiry: false },
  { key: 'chassis_trace', label: 'Chassis Trace Page', icon: '📋', hasExpiry: false },
  { key: 'tax_invoice', label: ' VP Tax Invoice', icon: '🧾', hasExpiry: false },
  { key: 'tax_invoice', label: 'SU Tax Invoice', icon: '🧾', hasExpiry: false },
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

const INS_DOCS = ['aadhar', 'pan', 'chassis_trace', 'tax_invoice', 'challan'];
const RTO_DOCS = ['aadhar', 'pan', 'tax_invoice', 'chassis_photo', 'insurance'];
const DEFAULT_INSURANCE_NUMBER = '918770259361';
const DEFAULT_RTO_NUMBER = '919752538014';

const folderKey = (name, date) => {
  const d = date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  return `${(name || 'Unknown').replace(/\s+/g, '_')}_${d}`;
};

// Robust image compression
async function compressImageRobust(dataUrl, maxWidth = 1200, quality = 0.8) {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    let width = bitmap.width, height = bitmap.height;
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const compressed = canvas.toDataURL('image/jpeg', quality);
    bitmap.close();
    return compressed;
  } catch (err) {
    console.warn('Compression failed, using original', err);
    return dataUrl;
  }
}

async function processFile(file, type) {
  return new Promise((resolve, reject) => {
    if (file.size > 30 * 1024 * 1024) {
      alert('फाइल 30MB से छोटी होनी चाहिए');
      reject('Too large');
      return;
    }
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

// Individual WhatsApp share function
async function shareDocumentToWhatsApp(doc) {
  let phone = prompt('📱 WhatsApp नंबर देश कोड के साथ (जैसे 919876543210):', '');
  if (!phone) return;
  // Remove any non-digits
  phone = phone.replace(/\D/g, '');
  if (!phone.startsWith('91')) phone = '91' + phone;
  
  let fileDisplay = '';
  if (doc.fileType === 'image') fileDisplay = `📷 Image: ${doc.docTypeLabel}`;
  else if (doc.fileType === 'pdf') fileDisplay = `📄 PDF: ${doc.docTypeLabel}`;
  else fileDisplay = `🎥 Video: ${doc.docTypeLabel}`;
  
  const msg = `📄 *VP Honda Document* – ${doc.customerName}\n📂 ${doc.docTypeLabel}\n📅 ${new Date(doc.savedAt).toLocaleDateString('en-IN')}\n\n(फोटो/PDF अलग से शेयर होगा)`;
  sendWhatsApp(phone, msg);
  
  // Open file in new tab for manual share
  setTimeout(() => {
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`
        <html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;">
          ${doc.fileType === 'video' ? `<video controls src="${doc.fileData}" style="max-width:100%;max-height:100vh;"></video>` :
            doc.fileType === 'pdf' ? `<iframe src="${doc.fileData}" style="width:100%;height:100vh;"></iframe>` :
            `<img src="${doc.fileData}" style="max-width:100%;max-height:100vh;" />`}
        </body></html>
      `);
    }
  }, 500);
}

export default function DocumentVault() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', aadharNo: '', vehicleModel: '', chassisNo: '',
    nomineeName: '', docType: 'aadhar', expiryDate: '', notes: ''
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
    setError(null);
    try {
      const data = await apiFetch('/api/documents');
      setDocs(data);
    } catch (err) {
      setError('❌ सर्वर से कनेक्ट नहीं हो पाया। कृपया बैकएंड API चेक करें');
      showInAppToast('API Error', 'बैकएंड कनेक्ट नहीं हो रहा', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveDoc = async (stayOpen = false) => {
    if (!form.customerName || !fileData) {
      alert('कृपया कस्टमर नाम और फाइल चुनें');
      return;
    }
    const docType = DOC_TYPES.find(d => d.key === form.docType) || DOC_TYPES[0];
    const now = new Date().toISOString();
    const newDoc = {
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
    try {
      const saved = await apiFetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDoc),
      });
      setDocs(prev => [saved, ...prev]);
      showInAppToast('☁️ डॉक्यूमेंट सेव हुआ', docType.label, 'success');
      if (!stayOpen) {
        setShowForm(false);
        setFileData(null);
        setForm({ customerName: '', customerPhone: '', aadharNo: '', vehicleModel: '', chassisNo: '', nomineeName: '', docType: 'aadhar', expiryDate: '', notes: '' });
        setCustSearch('');
      } else {
        setFileData(null);
        setForm({ ...form, docType: 'aadhar', expiryDate: '', notes: '' });
      }
    } catch (err) {
      alert('डॉक्यूमेंट सेव नहीं हुआ। बैकएंड चेक करें।');
    }
  };

  const deleteDoc = async (id) => {
    if (!window.confirm('क्या यह डॉक्यूमेंट डिलीट करना है?')) return;
    try {
      await apiFetch(`/api/documents/${id}`, { method: 'DELETE' });
      setDocs(prev => prev.filter(d => d.id !== id));
      showInAppToast('🗑️ डिलीट हो गया', '', 'success');
    } catch (err) {
      alert('डिलीट नहीं हो पाया। कृपया बैकएंड DELETE रूट चेक करें।');
    }
  };

  // File pickers
  const capturePhoto = async () => {
    setCapturing(true);
    try {
      const raw = await captureFromCamera('environment');
      const compressed = await compressImageRobust(raw);
      setFileData({ dataUrl: compressed, fileType: 'image', fileName: 'camera_photo.jpg' });
      showInAppToast('📷 फोटो कैप्चर + कंप्रेस', '', 'success');
    } catch (e) {
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
        showInAppToast('🖼️ गैलरी से फोटो चुनी गई', '', 'success');
      } catch (err) {
        alert('फोटो प्रोसेस नहीं हुई');
      }
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
      } catch (err) {
        alert('PDF प्रोसेस नहीं हुई');
      }
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
      } catch (err) {
        alert('वीडियो प्रोसेस नहीं हुई');
      }
    };
    input.click();
  };

  // Customers & initial load
  useEffect(() => {
    fetch(api('/api/customers'))
      .then(r => r.ok ? r.json() : [])
      .then(setCustomers)
      .catch(() => console.warn('Customers API failed'));
    loadDocuments();
  }, []);

  // Customer dropdown
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

  // Folder grouping
  const folders = docs.reduce((acc, d) => {
    const key = d.folder || folderKey(d.customerName, d.savedAt);
    if (!acc[key]) acc[key] = {
      name: d.customerName,
      phone: d.customerPhone,
      docs: [],
      date: d.savedAt,
      nomineeName: d.nomineeName
    };
    acc[key].docs.push(d);
    if (d.nomineeName) acc[key].nomineeName = d.nomineeName;
    return acc;
  }, {});
  const folderList = Object.entries(folders).sort((a, b) => new Date(b[1].date) - new Date(a[1].date));

  // Insurance & RTO group send (same as before)
  const sendInsurance = (folderDocs, folder) => {
    const available = INS_DOCS.filter(t => folderDocs.some(d => d.docType === t));
    const missing = INS_DOCS.filter(t => !folderDocs.some(d => d.docType === t));
    const nomineeName = folder.nomineeName || '—';
    let phone = prompt(`🛡️ Insurance WhatsApp नंबर (NBV Honda):`, DEFAULT_INSURANCE_NUMBER);
    if (!phone) return;
    const msg = `🛡️ *VP Honda — Insurance*\n👤 ${folder.name}\n📞 ${folder.phone}\n👥 Nominee: ${nomineeName}\n✅ ${available.map(t => DOC_TYPES.find(d => d.key === t)?.label).join('\n✅ ')}\n❌ ${missing.map(t => DOC_TYPES.find(d => d.key === t)?.label).join(', ')}`;
    sendWhatsApp(phone, msg);
    const files = folderDocs.filter(d => INS_DOCS.includes(d.docType));
    if (files.length) setTimeout(() => {
      if (window.confirm(`${files.length} फाइलें शेयर करें?`))
        files.forEach((f, i) => setTimeout(() => {
          const w = window.open('', '_blank');
          if (w) w.document.write(`<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;">${f.fileType==='video'?`<video controls src="${f.fileData}" style="max-width:100%;max-height:100vh;"></video>`:f.fileType==='pdf'?`<iframe src="${f.fileData}" style="width:100%;height:100vh;"></iframe>`:`<img src="${f.fileData}" style="max-width:100%;max-height:100vh;" />`}</body></html>`);
        }, i * 800));
    }, 1000);
  };

  const sendRTO = (folderDocs, folder) => {
    const available = RTO_DOCS.filter(t => folderDocs.some(d => d.docType === t));
    const missing = RTO_DOCS.filter(t => !folderDocs.some(d => d.docType === t));
    let phone = prompt(`🚗 RTO WhatsApp नंबर (Pal):`, DEFAULT_RTO_NUMBER);
    if (!phone) return;
    const first = folderDocs[0];
    const msg = `🚗 *VP Honda — RTO*\n👤 ${folder.name}\n📞 ${folder.phone}\n🏍️ ${first?.vehicleModel}\n🔢 ${first?.chassisNo}\n✅ ${available.map(t => DOC_TYPES.find(d => d.key === t)?.label).join('\n✅ ')}\n❌ ${missing.map(t => DOC_TYPES.find(d => d.key === t)?.label).join(', ')}`;
    sendWhatsApp(phone, msg);
    const files = folderDocs.filter(d => RTO_DOCS.includes(d.docType));
    if (files.length) setTimeout(() => {
      if (window.confirm(`${files.length} फाइलें शेयर करें?`))
        files.forEach((f, i) => setTimeout(() => {
          const w = window.open('', '_blank');
          if (w) w.document.write(`<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;">${f.fileType==='video'?`<video controls src="${f.fileData}" style="max-width:100%;max-height:100vh;"></video>`:f.fileType==='pdf'?`<iframe src="${f.fileData}" style="width:100%;height:100vh;"></iframe>`:`<img src="${f.fileData}" style="max-width:100%;max-height:100vh;" />`}</body></html>`);
        }, i * 800));
    }, 1000);
  };

  // Filter and expiry
  const filtered = view === 'all'
    ? docs.filter(d => !search || d.customerName.toLowerCase().includes(search.toLowerCase()) || (d.customerPhone || '').includes(search) || d.docTypeLabel.toLowerCase().includes(search.toLowerCase()) || (d.aadharNo || '').includes(search))
    : docs.filter(d => (d.folder || folderKey(d.customerName, d.savedAt)) === activeFolder);
  const expiringSoon = docs.filter(d => d.expiryDate && checkExpiry(d.expiryDate, d.docTypeLabel)?.status !== 'ok');

  if (loading) return <div style={{ padding: 20, color: 'white', textAlign: 'center', background: '#020617', minHeight: '100vh' }}>☁️ लोड हो रहा...</div>;
  if (error) return <div style={{ padding: 20, color: '#ef4444', textAlign: 'center', background: '#020617', minHeight: '100vh' }}>{error}<br /><button onClick={loadDocuments} style={{ marginTop: 10, background: '#DC0000', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8 }}>पुनः प्रयास करें</button></div>;

  return (
    <div style={{ padding: 14, background: '#020617', minHeight: '100vh', color: '#fff' }}>
      {/* Header same as before */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div><h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}><FolderOpen size={20} /> Document Vault</h1><p style={{ color: '#94a3b8', fontSize: 12 }}>{docs.length} docs · {folderList.length} folders · ☁️ Sync</p></div>
        <button onClick={() => setShowForm(true)} style={{ background: '#DC0000', padding: '10px 16px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>+ Add Document</button>
      </div>

      {/* Expiry Alerts */}
      {expiringSoon.length > 0 && (
        <div style={{ background: '#7c2d1222', border: '1px solid #ea580c', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
          <p style={{ color: '#fdba74', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> {expiringSoon.length} डॉक्यूमेंट जल्दी एक्सपायर होंगे!</p>
          {expiringSoon.map((d, i) => <p key={i} style={{ fontSize: 12, margin: '4px 0 0' }}>{d.docIcon} {d.customerName} · {d.docTypeLabel} · {checkExpiry(d.expiryDate, d.docTypeLabel)?.msg}</p>)}
        </div>
      )}

      {/* Search & View */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}><Search size={14} style={{ position: 'absolute', left: 12, top: 11, color: '#64748b' }} /><input value={search} onChange={e => { setSearch(e.target.value); setView('all'); if (!e.target.value) setView('folders'); }} placeholder="खोजें..." style={{ background: '#1e293b', color: '#fff', border: '1px solid #475569', borderRadius: 8, padding: '10px 12px 10px 34px', width: '100%' }} /></div>
        <button onClick={() => { setView('folders'); setSearch(''); setActiveFolder(null); }} style={{ background: view === 'folders' ? '#DC0000' : '#1e293b', padding: '8px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>📁 Folders</button>
        <button onClick={() => setView('all')} style={{ background: view === 'all' ? '#DC0000' : '#1e293b', padding: '8px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>📋 All Docs</button>
      </div>

      {/* Folder View (लिस्ट में डॉक्यूमेंट के नाम दिखेंगे) */}
      {view === 'folders' && !activeFolder && (
        <div style={{ display: 'grid', gap: 8 }}>
          {folderList.length === 0 ? <div style={{ background: '#0f172a', padding: 40, textAlign: 'center' }}>कोई डॉक्यूमेंट नहीं</div> :
            folderList.map(([key, folder]) => {
              const insCount = INS_DOCS.filter(t => folder.docs.some(d => d.docType === t)).length;
              const rtoCount = RTO_DOCS.filter(t => folder.docs.some(d => d.docType === t)).length;
              return (
                <div key={key} style={{ background: '#0f172a', borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ width: 44, height: 44, background: '#1e40af', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📁</div>
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { setActiveFolder(key); setView('folder_detail'); }}>
                      <p style={{ fontWeight: 800, margin: 0 }}>{folder.name}</p>
                      <p style={{ color: '#94a3b8', fontSize: 11 }}>📞 {folder.phone} · {folder.docs.length} docs</p>
                      {folder.nomineeName && <p style={{ color: '#c084fc', fontSize: 10 }}>Nominee: {folder.nomineeName}</p>}
                      {/* यहाँ डॉक्यूमेंट टाइप के नाम दिखेंगे */}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                        {folder.docs.slice(0, 5).map((d, idx) => (
                          <span key={idx} style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 4, fontSize: 9, color: '#cbd5e1' }}>
                            {d.docIcon} {d.docTypeLabel}
                          </span>
                        ))}
                        {folder.docs.length > 5 && <span style={{ fontSize: 9, color: '#64748b' }}>+{folder.docs.length-5} more</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button onClick={() => sendInsurance(folder.docs, folder)} style={{ background: insCount >= 3 ? '#16a34a' : '#334155', padding: '7px 12px', borderRadius: 8, fontSize: 11 }}>🛡️ Insurance ({insCount}/{INS_DOCS.length})</button>
                      <button onClick={() => sendRTO(folder.docs, folder)} style={{ background: rtoCount >= 3 ? '#7c3aed' : '#334155', padding: '7px 12px', borderRadius: 8, fontSize: 11 }}>🚗 RTO ({rtoCount}/{RTO_DOCS.length})</button>
                    </div>
                    <ChevronRight size={16} color="#64748b" style={{ cursor: 'pointer' }} onClick={() => { setActiveFolder(key); setView('folder_detail'); }} />
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Folder Detail View (with per-document WhatsApp share) */}
      {view === 'folder_detail' && activeFolder && (() => {
        const folder = folders[activeFolder];
        if (!folder) return null;
        const insCount = INS_DOCS.filter(t => folder.docs.some(d => d.docType === t)).length;
        const rtoCount = RTO_DOCS.filter(t => folder.docs.some(d => d.docType === t)).length;
        return (
          <div>
            <button onClick={() => { setActiveFolder(null); setView('folders'); }} style={{ background: '#1e293b', border: 'none', padding: '4px 10px', borderRadius: 6, marginBottom: 10, cursor: 'pointer' }}>← सभी फोल्डर</button>
            <div style={{ background: '#0f172a', borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <h2 style={{ margin: 0 }}>{folder.name}</h2>
              <p style={{ color: '#94a3b8' }}>📞 {folder.phone} · {folder.docs.length} docs</p>
              {folder.nomineeName && <p style={{ color: '#c084fc' }}>Nominee: {folder.nomineeName}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                <button onClick={() => sendInsurance(folder.docs, folder)} style={{ background: '#16a34a', padding: 12, borderRadius: 10, textAlign: 'left' }}>🛡️ Insurance ({insCount}/{INS_DOCS.length})</button>
                <button onClick={() => sendRTO(folder.docs, folder)} style={{ background: '#7c3aed', padding: 12, borderRadius: 10, textAlign: 'left' }}>🚗 RTO ({rtoCount}/{RTO_DOCS.length})</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
              {folder.docs.map(d => (
                <DocCard key={d.id} doc={d} onView={() => setViewDoc(d)} onDelete={() => deleteDoc(d.id)} onShare={() => shareDocumentToWhatsApp(d)} />
              ))}
              <div onClick={() => { setForm({ ...form, customerName: folder.name, customerPhone: folder.phone || '', nomineeName: folder.nomineeName || '' }); setCustSearch(folder.name); setShowForm(true); }} style={{ background: '#0f172a', border: '2px dashed #334155', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'pointer' }}>➕ Add Document</div>
            </div>
          </div>
        );
      })()}

      {/* All Docs View (same with share button) */}
      {view === 'all' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
          {filtered.map(d => <DocCard key={d.id} doc={d} onView={() => setViewDoc(d)} onDelete={() => deleteDoc(d.id)} onShare={() => shareDocumentToWhatsApp(d)} />)}
        </div>
      )}

      {/* Full View Modal */}
      {viewDoc && <FullViewModal doc={viewDoc} onClose={() => setViewDoc(null)} />}

      {/* Add Document Modal (unchanged) */}
      {showForm && (
        <div onClick={() => { setShowForm(false); setFileData(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0f172a', borderRadius: 14, width: '100%', maxWidth: 500, padding: 20, maxHeight: '94vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}><h2 style={{ margin: 0 }}>📄 नया डॉक्यूमेंट</h2><button onClick={() => { setShowForm(false); setFileData(null); }}><X size={18} /></button></div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <label style={lbl}>Customer Name *</label>
                <input value={custSearch} onChange={e => handleCustNameChange(e.target.value)} placeholder="नाम टाइप करें" style={inp} autoComplete="off" />
                {showDropdown && filteredCustomers.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1e293b', border: '1px solid #475569', borderRadius: 8, maxHeight: 200, overflowY: 'auto', zIndex: 60 }}>
                    {filteredCustomers.map((c, i) => (
                      <div key={i} onClick={() => selectCustomer(c)} style={{ padding: '8px 12px', cursor: 'pointer' }}>
                        <strong>{c.customerName || c.name}</strong><br /><span style={{ fontSize: 11 }}>📞 {c.mobileNo || c.phone} · 🪪 {c.aadhar || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div><label style={lbl}>Mobile Number</label><input value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value.replace(/\D/g, '') })} maxLength={10} style={inp} /></div>
              <div><label style={lbl}>Aadhar Number</label><input value={form.aadharNo} onChange={e => setForm({ ...form, aadharNo: e.target.value.replace(/\D/g, '').slice(0, 12) })} maxLength={12} style={inp} /></div>
              <div><label style={lbl}>Nominee Name</label><input value={form.nomineeName} onChange={e => setForm({ ...form, nomineeName: e.target.value })} placeholder="जैसे: Sita Devi" style={inp} /></div>
              <div><label style={lbl}>Vehicle Model</label><input value={form.vehicleModel} onChange={e => setForm({ ...form, vehicleModel: e.target.value })} placeholder="SP125" style={inp} /></div>
              <div><label style={lbl}>Chassis No</label><input value={form.chassisNo} onChange={e => setForm({ ...form, chassisNo: e.target.value.toUpperCase() })} placeholder="ME4JC94FDTG104998" style={inp} /></div>
              <div><label style={lbl}>Document Type</label><select value={form.docType} onChange={e => setForm({ ...form, docType: e.target.value })} style={inp}>{DOC_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}</select></div>
              {DOC_TYPES.find(t => t.key === form.docType)?.hasExpiry && <div><label style={lbl}>Expiry Date</label><input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} style={inp} /></div>}
              <div><label style={lbl}>Notes</label><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional" style={inp} /></div>
              <div>
                <label style={lbl}>📎 फाइल अपलोड करें *</label>
                {fileData ? (
                  <div style={{ position: 'relative', background: '#1e293b', borderRadius: 8, padding: 8 }}><p style={{ fontSize: 12, margin: 0 }}>✅ {fileData.fileName} ({fileData.fileType})</p><button onClick={() => setFileData(null)} style={{ position: 'absolute', top: 4, right: 4, background: '#dc2626', border: 'none', borderRadius: '50%', width: 24, height: 24 }}>×</button></div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button onClick={capturePhoto} disabled={capturing} style={{ background: '#1e3a8a', padding: 12, borderRadius: 8 }}><Camera size={18} /> कैमरा</button>
                    <button onClick={pickFromGallery} style={{ background: '#1a1a2e', padding: 12, borderRadius: 8 }}><Image size={18} /> गैलरी</button>
                    <button onClick={pickPDF} style={{ background: '#854d0e', padding: 12, borderRadius: 8 }}><FileText size={18} /> PDF</button>
                    <button onClick={pickVideo} style={{ background: '#4c1d95', padding: 12, borderRadius: 8 }}><Video size={18} /> वीडियो</button>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => saveDoc(true)} disabled={!fileData} style={{ flex: 1, background: fileData ? '#2563eb' : '#475569', padding: 12, borderRadius: 10, fontWeight: 800 }}>➕ Save & Add Another</button>
              <button onClick={() => saveDoc(false)} disabled={!fileData} style={{ flex: 1, background: fileData ? '#DC0000' : '#475569', padding: 12, borderRadius: 10, fontWeight: 800 }}>💾 Save & Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Document Card with WhatsApp share button
function DocCard({ doc, onView, onDelete, onShare }) {
  let icon = <Image size={24} />;
  if (doc.fileType === 'pdf') icon = <FileText size={24} />;
  if (doc.fileType === 'video') icon = <Video size={24} />;
  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, overflow: 'hidden' }}>
      <div onClick={onView} style={{ cursor: 'pointer', height: 120, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div style={{ padding: 8 }}>
        <p style={{ fontWeight: 700, fontSize: 11, margin: 0 }}>{doc.customerName}</p>
        <p style={{ color: '#64748b', fontSize: 9, margin: '2px 0' }}>{doc.docTypeLabel}</p>
        <p style={{ color: '#64748b', fontSize: 9, margin: 0 }}>{new Date(doc.savedAt).toLocaleDateString('en-IN')}</p>
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          <button onClick={onView} style={{ flex: 1, background: '#1e40af', padding: '4px', borderRadius: 4, fontSize: 9, cursor: 'pointer' }}><Eye size={12} /> देखें</button>
          <button onClick={onShare} style={{ flex: 1, background: '#25D366', padding: '4px', borderRadius: 4, fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}><Share2 size={12} /> शेयर</button>
          <button onClick={onDelete} style={{ background: '#7f1d1d', padding: '4px', borderRadius: 4, fontSize: 9, cursor: 'pointer' }}><Trash2 size={12} /></button>
        </div>
      </div>
    </div>
  );
}

function FullViewModal({ doc, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0f172a', borderRadius: 14, maxWidth: 640, width: '100%', maxHeight: '94vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between' }}>
          <div><strong>{doc.docIcon} {doc.docTypeLabel}</strong><br /><span style={{ fontSize: 11 }}>{doc.customerName}</span></div>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', textAlign: 'center', padding: 10 }}>
          {doc.fileType === 'image' && <img src={doc.fileData} alt={doc.docTypeLabel} style={{ maxWidth: '100%' }} />}
          {doc.fileType === 'pdf' && <iframe src={doc.fileData} style={{ width: '100%', height: '80vh' }} title="PDF" />}
          {doc.fileType === 'video' && <video src={doc.fileData} controls style={{ width: '100%', maxHeight: '80vh' }} />}
        </div>
      </div>
    </div>
  );
}

const lbl = { color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 4, display: 'block' };
const inp = { background: '#1e293b', color: '#fff', border: '1px solid #475569', borderRadius: 8, padding: '10px 12px', fontSize: 13, width: '100%', outline: 'none' };
