// ════════════════════════════════════════════════════════════════════════════
// hondaRateList.js — VP Honda Vehicle Models, Variants, Colors, Prices
// Data extracted from Rate_List Excel sheet
//
// ⭐ IMPORTANT: exShowroom price is the ACTUAL selling price (already includes 18% GST)
// When generating Tax Invoice, prices are reverse-calculated:
//    Taxable Price = Ex-Showroom ÷ 1.18
//    SGST (9%) = Taxable × 0.09
//    CGST (9%) = Taxable × 0.09
//    Total = Taxable + SGST + CGST  (= Ex-Showroom)
// ════════════════════════════════════════════════════════════════════════════

export const HONDA_MODELS = [
  // ═══ SCOOTER OBD2B ═══
  { id: 1,  category: 'Scooter', name: 'ACTIVA STD-OBD2B',         cc: '109.51 CC', exShowroom: 76946  },
  { id: 2,  category: 'Scooter', name: 'ACTIVA DLX-OBD2B',         cc: '109.51 CC', exShowroom: 87224  },
  { id: 3,  category: 'Scooter', name: 'ACTIVA DLX-AE OBD 2B',     cc: '109.51 CC', exShowroom: 86452  },
  { id: 4,  category: 'Scooter', name: 'ACTIVA 125 DISC OBD2B',    cc: '124 CC',    exShowroom: 92341  },
  { id: 5,  category: 'Scooter', name: 'ACTIVA 125 Smart 2B',      cc: '124 CC',    exShowroom: 96785  },
  { id: 6,  category: 'Scooter', name: 'Activa ANNIVERSAR EDITION',cc: '125 CC',    exShowroom: 91570  },
  { id: 7,  category: 'Scooter', name: 'Activa DIO DLX OBD2B',     cc: '110 CC',    exShowroom: 85128  },

  // ═══ BIKE OBD2B ═══
  { id: 10, category: 'Bike',    name: 'SHINE 100-OBD2B',          cc: '98.99 CC',  exShowroom: 65390  },
  { id: 11, category: 'Bike',    name: 'SHINE 100 DX-OBD2B',       cc: '98.99 CC',  exShowroom: 70196  },
  { id: 12, category: 'Bike',    name: 'SHINE 125 DRUM-OBD2B',     cc: '123.94 CC', exShowroom: 80582  },
  { id: 13, category: 'Bike',    name: 'SHINE 125 DISK-OBD2B',     cc: '123.94 CC', exShowroom: 84941  },
  { id: 14, category: 'Bike',    name: 'SHINE 125 DISK-OBD2B LE',  cc: '123.94 CC', exShowroom: 85941  },
  { id: 15, category: 'Bike',    name: 'SP125 STD DRUM OBD2B',     cc: '123.94 CC', exShowroom: 88867  },
  { id: 16, category: 'Bike',    name: 'SP125 DLX DISK OBD2B',     cc: '123.94 CC', exShowroom: 96455  },
  { id: 17, category: 'Bike',    name: 'SP 125 DLX DISK-AE OBD2B', cc: '125 CC',    exShowroom: 94409  },
  { id: 18, category: 'Bike',    name: 'LIVO 110 DRUM-OBD2B',      cc: '110 CC',    exShowroom: 78243  },
  { id: 19, category: 'Bike',    name: 'LIVO 110 DISK-OBD2B',      cc: '110 CC',    exShowroom: 80810  },
  { id: 20, category: 'Bike',    name: 'HORNET 2.0 ABS-OBD2B',     cc: '185 CC',    exShowroom: 147846 },
  { id: 21, category: 'Bike',    name: 'HORNET DELUXE OBD 2B',     cc: '125 CC',    exShowroom: 115234 },
  { id: 22, category: 'Bike',    name: 'SP-160 STD 1 Disk 2B',     cc: '160 CC',    exShowroom: 116648 },
  { id: 23, category: 'Bike',    name: 'SP-160 DLX 2 Disk 2B',     cc: '160 CC',    exShowroom: 122158 },
];

// ⭐ HELPER: Calculate tax breakdown from Ex-Showroom price (reverse calculation)
// Used when generating Tax Invoice
export const calculateTaxBreakdown = (exShowroomPrice) => {
  const exShowroom = parseFloat(exShowroomPrice) || 0;
  const taxable = exShowroom / 1.18;            // Ex-Showroom = Taxable × 1.18
  const sgst = taxable * 0.09;                  // 9% SGST
  const cgst = taxable * 0.09;                  // 9% CGST
  const total = taxable + sgst + cgst;          // = Ex-Showroom (verify)
  return {
    exShowroom: Number(exShowroom.toFixed(2)),
    taxable:    Number(taxable.toFixed(2)),
    sgst:       Number(sgst.toFixed(2)),
    cgst:       Number(cgst.toFixed(2)),
    total:      Number(total.toFixed(2)),
  };
};

// Build ordered list of unique variant strings (CC values)
export const HONDA_VARIANTS = [...new Set(HONDA_MODELS.map(m => m.cc))].sort();

// Common colors for Honda vehicles (from Excel screenshots)
export const HONDA_COLORS = [
  'BLACK',
  'BLACK F',
  'BLACK H',
  'BLACK D',
  'BLACK MATTALIC',
  'GREY',
  'M A GREY M',
  'MAT STEEL BLACK META',
  'PRL IGNS BLK-GRAY SR',
  'DECENT BLUE METALLIC',
  'P BLACK',
  'MAT MARVEL BLUE MET',
  'P S BLUE',
  'I RED-M',
  'WHITE',
  'CRUST METALLIC',
  'PEARL DEEP RED',
  'PEARL IGNEOUS BLACK',
  'MATTE AXIS GRAY',
  'PEARL SPARTAN RED',
  'PEARL SIREN BLUE',
];

// Finance company list (from Excel sheet — 261-268)
export const FINANCE_COMPANIES = [
  'CASH',
  'HDB FINANCIAL SERVICES LTD.',
  'IDFC FIRST BANK LTD.',
  'AU SMALL FINANCE BANK LTD',
  'JANA SMALL FINANCE BANK',
  'BOI TARASEWANIYA',
  'DD',
  'MUTHOOT CAPITALSERVICES LTD',
  'SBI',
  'HDFC BANK',
  'ICICI BANK',
  'AXIS BANK',
  'BAJAJ FINANCE',
  'TATA CAPITAL',
  'L&T FINANCE',
  'MAHINDRA FINANCE',
  'OTHER',
];

// HSN codes for Honda 2-wheelers
export const HSN_CODES = {
  'Scooter': '87112019',
  'Bike':    '87112029',
  'default': '87112029',
};

// Helper: lookup model by name (case-insensitive)
export const findModel = (modelName) => {
  if (!modelName) return null;
  const target = String(modelName).trim().toUpperCase();
  return HONDA_MODELS.find(m =>
    m.name.toUpperCase() === target ||
    m.name.toUpperCase().replace(/\s+/g, '') === target.replace(/\s+/g, '')
  ) || null;
};

// Helper: get HSN by model
export const getHSN = (modelName) => {
  const m = findModel(modelName);
  if (!m) return HSN_CODES.default;
  return HSN_CODES[m.category] || HSN_CODES.default;
};

// Helper: list models grouped by category for dropdown
export const getModelsByCategory = () => {
  const grouped = {};
  HONDA_MODELS.forEach(m => {
    if (!grouped[m.category]) grouped[m.category] = [];
    grouped[m.category].push(m);
  });
  return grouped;
};