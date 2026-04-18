import { extractTextFromPDF, parseInvoiceFromText } from '../utils/pdfParser';

// ... component के अंदर
const handleFileChange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    // 1. PDF से text निकालें
    const rawText = await extractTextFromPDF(file);
    
    // 2. Text से structured invoice बनाएँ
    const invoiceData = parseInvoiceFromText(rawText);
    
    // 3. Backend पर JSON POST करें
    const response = await fetch('https://vp-honda-backend.onrender.com/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceData)
    });
    
    if (!response.ok) throw new Error('Backend save failed');
    const saved = await response.json();
    console.log('Saved invoice:', saved);
    alert('Invoice imported successfully!');
    
    // अगर invoice list refresh करनी है तो वहाँ call करें
    // fetchInvoices();
    
  } catch (err) {
    console.error('Import error:', err);
    alert('Failed to import: ' + err.message);
  }
};