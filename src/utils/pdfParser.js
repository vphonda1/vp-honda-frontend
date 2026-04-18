import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export const extractTextFromPDF = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }
  return fullText;
};

export const parseInvoiceFromText = (text) => {
  if (!text) return {};
  const clean = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
  
  let invoiceNo = '', customer = '', vehicle = '', regNo = '', date = '';
  const invMatch = clean.match(/(?:Invoice|Invoice No|#)\s*[#:]?\s*([A-Z0-9-]+)/i);
  if (invMatch) invoiceNo = invMatch[1];
  const custMatch = clean.match(/(?:CLIENT|Customer|Name)[:\s]*([A-Z\s]+?)(?=\d|\n|Vehicle|Reg)/i);
  if (custMatch) customer = custMatch[1].trim();
  const vehMatch = clean.match(/Vehicle[:\s]*([^\n]+)/i);
  if (vehMatch) vehicle = vehMatch[1].trim();
  const regMatch = clean.match(/Reg(?:istration)?\s*No[:\s]*([A-Z0-9]+)/i);
  if (regMatch) regNo = regMatch[1];
  const dateMatch = clean.match(/Date[:\s]*(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) date = dateMatch[1];
  
  const parts = [];
  const lines = text.split('\n');
  let inTable = false;
  for (let line of lines) {
    line = line.trim();
    if (/Part\s*No|Sr\./i.test(line)) { inTable = true; continue; }
    if (inTable && /Total|Subtotal|Tax|Grand|Payable/i.test(line)) break;
    if (inTable && line.match(/^(\d+)\s+([A-Z0-9\-]+)/)) {
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
  
  return {
    invoiceNumber: invoiceNo,
    customerName: customer,
    vehicleNumber: vehicle,
    regNo: regNo,
    date: date,
    invoiceType: 'Service',
    totalAmount: total,
    parts: parts
  };
};