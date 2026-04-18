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
  // यहाँ वही parser डालें जो मैंने पहले दिया था (parts, total आदि निकालने के लिए)
  // आप चाहें तो मैं पूरा parser फिर से दे सकता हूँ
  // फिलहाल आपका पुराना parser काम करेगा
  // ...
  return { invoiceNumber, customerName, parts, totalAmount, ... };
};