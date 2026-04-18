import React, { useState } from 'react';

const InvoiceUpload = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // ... यहाँ वही extractTextFromPDF और parseInvoiceFromText फ़ंक्शन रहेंगे जो पहले से हैं ...
  // (मैं मान रहा हूँ कि आपके पास ये फ़ंक्शन पहले से मौजूद हैं)

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const rawText = await extractTextFromPDF(file);
      const invoiceData = parseInvoiceFromText(rawText);
      
      // ⭐ बस यही एक लाइन बदली है – अब parse-pdf नहीं, सीधे /api/invoices
      const response = await fetch('https://vp-honda-backend.onrender.com/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      });
      
      if (!response.ok) throw new Error('Backend error');
      const saved = await response.json();
      alert('✅ Invoice imported!');
      if (onUploadSuccess) onUploadSuccess(saved);
    } catch (err) {
      setError(err.message);
      alert('❌ Failed: ' + err.message);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div>
      <input type="file" accept="application/pdf" onChange={handleFileChange} disabled={uploading} />
      {uploading && <p>Processing...</p>}
      {error && <p style={{color:'red'}}>{error}</p>}
    </div>
  );
};

export default InvoiceUpload;