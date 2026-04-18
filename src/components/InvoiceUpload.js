import { extractTextFromPDF, parseInvoiceFromText } from '../utils/pdfParser';

// ... component के अंदर
const handleFileChange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    // Step 1: PDF से text निकालें
    const rawText = await extractTextFromPDF(file);
    
    // Step 2: Text से structured data बनाएँ
    const invoiceData = parseInvoiceFromText(rawText);
    
    // Step 3: Backend को JSON भेजें
    const response = await fetch('https://vp-honda-backend.onrender.com/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceData)
    });
    
    const result = await response.json();
    console.log('Invoice saved:', result);
    alert('Invoice imported successfully!');
    
  } catch (error) {
    console.error('Import error:', error);
    alert('Failed to import invoice');
  }
};