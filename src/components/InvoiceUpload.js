import React, { useState } from 'react';
import { extractTextFromPDF, parseInvoiceFromText } from '../utils/pdfParser';

const InvoiceUpload = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      // 1. PDF से text निकालें
      const rawText = await extractTextFromPDF(file);
      
      // 2. Text से structured invoice data बनाएँ
      const invoiceData = parseInvoiceFromText(rawText);
      
      // 3. Backend को JSON भेजें (सीधे /api/invoices पर POST)
      const response = await fetch('https://vp-honda-backend.onrender.com/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Backend save failed');
      }
      
      const saved = await response.json();
      console.log('Invoice saved:', saved);
      alert('✅ Invoice imported successfully!');
      
      // अगर parent component को refresh करना है
      if (onUploadSuccess) onUploadSuccess(saved);
      
    } catch (err) {
      console.error('Import error:', err);
      setError(err.message);
      alert('❌ Failed to import: ' + err.message);
    } finally {
      setUploading(false);
      // Clear file input so same file can be uploaded again
      event.target.value = '';
    }
  };

  return (
    <div className="invoice-upload-container">
      <h3>Import Service/Part Invoice (PDF)</h3>
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {uploading && <p>Processing PDF... Please wait.</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
  );
};

export default InvoiceUpload;