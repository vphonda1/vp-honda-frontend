import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const InvoiceUpload = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const extractTextFromPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + '\n';
    }
    return fullText;
  };

  const parseInvoiceFromText = (text) => {
    if (!text) return {};
    const clean = text.replace(/\s+/g, ' ').trim();
    let invoiceNo = '', customer = '', vehicle = '', regNo = '', date = '';
    const invMatch = clean.match(/(?:Invoice|#)\s*([A-Z0-9-]+)/i);
    if (invMatch) invoiceNo = invMatch[1];
    const custMatch = clean.match(/(?:CLIENT|Customer)[:\s]*([A-Z\s]+?)(?=\d|\n|Vehicle)/i);
    if (custMatch) customer = custMatch[1].trim();
    const vehMatch = clean.match(/Vehicle[:\s]*([^\n]+)/i);
    if (vehMatch) vehicle = vehMatch[1].trim();
    const regMatch = clean.match(/Reg\s*No[:\s]*([A-Z0-9]+)/i);
    if (regMatch) regNo = regMatch[1];
    const dateMatch = clean.match(/Date[:\s]*(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) date = dateMatch[1];
    
    const parts = [];
    const lines = text.split('\n');
    let inTable = false;
    for (let line of lines) {
      line = line.trim();
      if (/Part\s*No|Sr\./i.test(line)) { inTable = true; continue; }
      if (inTable && /Total|Subtotal|Tax/i.test(line)) break;
      if (inTable && line.match(/^\d+\s+[A-Z0-9\-]+/)) {
        const tokens = line.split(/\s+/);
        if (tokens.length >= 5) {
          parts.push({
            partNo: tokens[1],
            description: tokens.slice(2, -3).join(' '),
            quantity: parseInt(tokens[tokens.length-3]),
            mrp: parseFloat(tokens[tokens.length-2].replace(/[₹,]/g, '')),
            taxable: parseFloat(tokens[tokens.length-1].replace(/[₹,]/g, '')),
            gst: 18
          });
        }
      }
    }
    
    let total = 0;
    const totalMatch = clean.match(/Total\s+Payable\s+Amount[:\s]*[₹]?([\d,]+)/i) ||
                       clean.match(/Invoice Value[:\s]*[₹]?([\d,]+)/i) ||
                       clean.match(/Grand\s+Total[:\s]*[₹]?([\d,]+)/i);
    if (totalMatch) total = parseFloat(totalMatch[1].replace(/,/g, ''));
    else if (parts.length) total = parts.reduce((s,p) => s + (p.mrp * p.quantity), 0);
    
    return { invoiceNumber: invoiceNo, customerName: customer, vehicleNumber: vehicle, regNo, date, invoiceType: 'Service', totalAmount: total, parts };
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const rawText = await extractTextFromPDF(file);
      const invoiceData = parseInvoiceFromText(rawText);
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