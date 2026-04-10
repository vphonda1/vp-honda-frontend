// ImprovedPDFParser.js
// Advanced PDF parsing with better regex patterns and fallbacks

export const parseInvoiceFromText = (text) => {
  try {
    // ===== CUSTOMER DETAILS =====
    
    // Customer Name - Try multiple patterns
    let customerName = 'Unknown';
    const namePatterns = [
      /Customer Name[\s:]*([A-Za-z\s]+)/i,
      /Name[\s:]*([A-Za-z\s]+)/i,
      /Mr\.?\s+([A-Za-z\s]+)/i,
      /Mrs\.?\s+([A-Za-z\s]+)/i,
      /Ms\.?\s+([A-Za-z\s]+)/i,
    ];
    
    for (let pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) {
        customerName = match[1].trim();
        break;
      }
    }

    // Phone Number
    let customerPhone = '';
    const phonePatterns = [
      /Phone[\s:]*(\d{10})/i,
      /Mobile[\s:]*(\d{10})/i,
      /Contact[\s:]*(\d{10})/i,
      /(\d{10})/,
    ];
    
    for (let pattern of phonePatterns) {
      const match = text.match(pattern);
      if (match) {
        customerPhone = match[1];
        break;
      }
    }

    // ===== VEHICLE DETAILS =====
    
    let vehicleName = 'Unknown';
    let regNo = '';
    
    const vehiclePatterns = [
      /Vehicle[\s:]*([A-Za-z\s0-9]+)/i,
      /Car[\s:]*([A-Za-z\s0-9]+)/i,
      /Model[\s:]*([A-Za-z\s0-9]+)/i,
    ];
    
    for (let pattern of vehiclePatterns) {
      const match = text.match(pattern);
      if (match) {
        vehicleName = match[1].trim();
        break;
      }
    }

    const regPatterns = [
      /Registration[\s:]*([A-Z0-9\-]+)/i,
      /Reg No[\s:]*([A-Z0-9\-]+)/i,
      /Reg[\s:]*([A-Z0-9\-]+)/i,
    ];
    
    for (let pattern of regPatterns) {
      const match = text.match(pattern);
      if (match) {
        regNo = match[1].trim();
        break;
      }
    }

    // ===== INVOICE DETAILS =====
    
    let invoiceNumber = Math.floor(Math.random() * 100000);
    const invoicePatterns = [
      /Invoice\s*(?:No|Number|#)[\s:]*(\d+)/i,
      /Invoice[\s:]*(\d+)/i,
      /Bill\s*(?:No|Number)[\s:]*(\d+)/i,
    ];
    
    for (let pattern of invoicePatterns) {
      const match = text.match(pattern);
      if (match) {
        invoiceNumber = parseInt(match[1]);
        break;
      }
    }

    // Invoice Date
    let invoiceDate = new Date().toISOString().split('T')[0];
    const datePatterns = [
      /(?:Invoice|Bill)\s+Date[\s:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
      /Date[\s:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
      /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
    ];
    
    for (let pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        const [day, month, year] = match[1].split(/[-\/]/);
        const fullYear = year.length === 2 ? `20${year}` : year;
        invoiceDate = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        break;
      }
    }

    // ===== AMOUNT EXTRACTION =====
    
    let totalAmount = 0;
    const amountPatterns = [
      /Total Amount[\s:]*₹?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
      /Grand Total[\s:]*₹?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
      /Total[\s:]*₹?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
      /Amount[\s:]*₹?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
      /₹\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/,
    ];
    
    for (let pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match) {
        totalAmount = parseFloat(match[1].replace(/,/g, ''));
        break;
      }
    }

    // ===== PARTS EXTRACTION =====
    
    let parts = [];
    
    // Try to find parts table or list
    const partsPatterns = [
      // Pattern 1: Part name | Qty | Price
      /([A-Za-z\s]+?)\s*\|\s*(\d+)\s*\|\s*₹?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
      
      // Pattern 2: Part name - Qty - Price
      /([A-Za-z\s]+?)\s*-\s*(\d+)\s*-\s*₹?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
      
      // Pattern 3: Description Qty Price (space separated)
      /([A-Za-z\s]+?)\s{2,}(\d+)\s{2,}₹?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
    ];
    
    for (let pattern of partsPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const partName = match[1].trim();
        const qty = parseInt(match[2]);
        const price = parseFloat(match[3].replace(/,/g, ''));
        
        if (partName.length > 2 && qty > 0 && price > 0) {
          parts.push({
            partNo: partName,
            description: partName,
            quantity: qty,
            price: price,
            total: qty * price
          });
        }
      }
      
      if (parts.length > 0) break;
    }

    // ===== SERVICE TYPE =====
    
    let serviceType = 'General Service';
    const servicePatterns = [
      /Service Type[\s:]*([A-Za-z\s]+)/i,
      /Service[\s:]*([A-Za-z\s]+)/i,
      /(Maintenance|Repair|General Service|First Service|Second Service)/i,
    ];
    
    for (let pattern of servicePatterns) {
      const match = text.match(pattern);
      if (match) {
        serviceType = match[1].trim();
        break;
      }
    }

    // ===== RETURN STRUCTURED DATA =====
    
    return {
      success: true,
      data: {
        customer: {
          name: customerName,
          phone: customerPhone,
        },
        vehicle: {
          name: vehicleName,
          regNo: regNo,
        },
        invoice: {
          number: invoiceNumber,
          date: invoiceDate,
          amount: totalAmount,
          serviceType: serviceType,
        },
        parts: parts,
        extractedSuccessfully: {
          customerName: customerName !== 'Unknown',
          amount: totalAmount > 0,
          parts: parts.length > 0,
          invoiceDate: invoiceDate !== new Date().toISOString().split('T')[0],
        }
      }
    };

  } catch (error) {
    console.error('Error parsing PDF:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Validate extracted data
export const validateInvoiceData = (data) => {
  const issues = [];
  
  if (!data.customer.name || data.customer.name === 'Unknown') {
    issues.push('Customer name not found');
  }
  
  if (data.invoice.amount === 0) {
    issues.push('Invoice amount not found');
  }
  
  if (data.parts.length === 0) {
    issues.push('No parts found in invoice');
  }
  
  if (data.vehicle.name === 'Unknown') {
    issues.push('Vehicle details not found');
  }
  
  return {
    isValid: issues.length === 0,
    issues: issues,
    confidence: {
      customer: data.customer.name !== 'Unknown' ? 100 : 0,
      amount: data.invoice.amount > 0 ? 100 : 0,
      parts: data.parts.length > 0 ? (data.parts.length / 5) * 100 : 0,
      vehicle: data.vehicle.name !== 'Unknown' ? 100 : 0,
    }
  };
};