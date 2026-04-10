import jsPDF from 'jspdf';
import 'jspdf-autotable';

export class InvoiceGenerator {
  generateInvoice(invoiceData, settings) {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(220, 38, 38); // Red color
    doc.text(settings.businessName || 'V P HONDA', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(settings.address || 'Raipur, Chhattisgarh', 105, 28, { align: 'center' });
    
    if (settings.gst) {
      doc.text(`GST: ${settings.gst}`, 105, 34, { align: 'center' });
    }
    
    // Invoice details
    doc.setFontSize(16);
    doc.text('TAX INVOICE', 105, 45, { align: 'center' });
    
    doc.setFontSize(10);
    const invoiceDate = new Date().toLocaleDateString('en-IN');
    doc.text(`Invoice No: ${invoiceData.invoiceNumber || 'AUTO'}`, 14, 55);
    doc.text(`Date: ${invoiceDate}`, 14, 61);
    
    // Customer details
    doc.setFontSize(12);
    doc.text('Customer Details:', 14, 75);
    doc.setFontSize(10);
    doc.text(`Name: ${invoiceData.customerName}`, 14, 82);
    doc.text(`Mobile: ${invoiceData.mobile}`, 14, 88);
    doc.text(`Address: ${invoiceData.address}`, 14, 94);
    
    // Vehicle details
    doc.setFontSize(12);
    doc.text('Vehicle Details:', 14, 108);
    doc.setFontSize(10);
    doc.text(`Model: ${invoiceData.vehicle}`, 14, 115);
    doc.text(`Color: ${invoiceData.color}`, 14, 121);
    doc.text(`Chassis No: ${invoiceData.chassisNo}`, 14, 127);
    doc.text(`Engine No: ${invoiceData.engineNo}`, 14, 133);
    
    // Pricing table
    const tableData = [
      ['Ex-Showroom Price', `₹${invoiceData.exShowroom.toLocaleString('en-IN')}`],
      ['RTO Charges', `₹${invoiceData.rto.toLocaleString('en-IN')}`],
      ['Insurance', `₹${invoiceData.insurance.toLocaleString('en-IN')}`],
      ['Accessories', `₹${invoiceData.accessories.toLocaleString('en-IN')}`],
      ['Total Amount', `₹${invoiceData.total.toLocaleString('en-IN')}`]
    ];
    
    doc.autoTable({
      startY: 145,
      head: [['Description', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [220, 38, 38] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
    });
    
    // Payment mode
    if (invoiceData.paymentMode) {
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.text(`Payment Mode: ${invoiceData.paymentMode}`, 14, finalY);
      if (invoiceData.bank) {
        doc.text(`Bank: ${invoiceData.bank}`, 14, finalY + 6);
      }
    }
    
    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.text('Thank you for your business!', 105, pageHeight - 20, { align: 'center' });
    doc.text('This is a computer-generated invoice.', 105, pageHeight - 15, { align: 'center' });
    
    return doc;
  }

  downloadInvoice(invoiceData, settings) {
    const doc = this.generateInvoice(invoiceData, settings);
    const filename = `Invoice_${invoiceData.customerName}_${Date.now()}.pdf`;
    doc.save(filename);
  }

  printInvoice(invoiceData, settings) {
    const doc = this.generateInvoice(invoiceData, settings);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  }
}

export const generateJobCardPDF = (data) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(18);
  doc.text('V P HONDA', 105, 15, { align: 'center' });
  doc.setFontSize(10);
  doc.text('Narsinghgarh Road, Parwaliya Sadak, Bhopal, M.P.', 105, 22, { align: 'center' });
  doc.text('GSTIN: 23BCYPD9538B1ZG | Phone: 9713394738', 105, 28, { align: 'center' });
  
  // Invoice Title
  doc.setFontSize(14);
  doc.text('TAX INVOICE - JOB CARD', 105, 38, { align: 'center' });
  
  // Details
  doc.setFontSize(10);
  doc.text(`Job Card No: ${data.jobCardNo}`, 14, 48);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, 48);
  
  doc.text(`Customer: ${data.customerName || ''}`, 14, 55);
  doc.text(`Vehicle: ${data.vehicleModel || ''}`, 14, 62);
  doc.text(`Service Type: ${data.serviceType}`, 14, 69);
  doc.text(`KM: ${data.serviceKm}`, 140, 69);
  
  // Parts Table
  const tableColumn = ["Part No", "Description", "Qty", "Unit Price", "Discount", "Taxable"];
  const tableRows = [];
  
  data.parts.forEach(part => {
    const row = [
      part.partNo,
      part.description,
      part.quantity,
      `₹${part.unitPrice}`,
      `${part.discount}%`,
      `₹${part.taxableAmount.toFixed(2)}`
    ];
    tableRows.push(row);
  });
  
  doc.autoTable({
    startY: 80,
    head: [tableColumn],
    body: tableRows,
    theme: 'striped',
    styles: { fontSize: 8 }
  });
  
  const finalY = doc.lastAutoTable.finalY + 10;
  
  // Totals
  doc.text(`Parts Total: ₹${data.partsTotal || 0}`, 140, finalY);
  doc.text(`CGST (9%): ₹${data.cgst || 0}`, 140, finalY + 7);
  doc.text(`SGST (9%): ₹${data.sgst || 0}`, 140, finalY + 14);
  doc.text(`Labour: ₹${data.labourCharges || 0}`, 140, finalY + 21);
  doc.text(`Grand Total: ₹${data.grandTotal || 0}`, 140, finalY + 28);
  
  // Terms
  doc.setFontSize(8);
  doc.text('Terms & Conditions:', 14, finalY + 40);
  doc.text('1. All disputes are subject to Bhopal Jurisdiction', 14, finalY + 47);
  doc.text('2. Goods once sold will not be taken back', 14, finalY + 54);
  
  // Signature
  doc.text('For V P HONDA', 140, finalY + 50);
  doc.text('Authorized Signatory', 140, finalY + 57);
  
  doc.save(`JobCard-${data.jobCardNo}.pdf`);
};

export const invoiceGen = new InvoiceGenerator();