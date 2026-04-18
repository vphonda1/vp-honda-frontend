import { extractTextFromPDF, parseInvoiceFromText } from '../utils/pdfParser';

const handleUpload = async (file) => {
  try {
    const rawText = await extractTextFromPDF(file);
    const invoiceData = parseInvoiceFromText(rawText);
    const response = await fetch('https://vp-honda-backend.onrender.com/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceData)
    });
    const result = await response.json();
    console.log('Saved:', result);
    alert('Invoice imported!');
  } catch (err) {
    console.error(err);
    alert('Failed: ' + err.message);
  }
};