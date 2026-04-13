// ═══════════════════════════════════════════════════════════════════
// VP Honda — Data Service (MongoDB Primary, localStorage Cache)
// Import: import { dataService } from '../utils/dataService';
// Usage: const customers = await dataService.customers.load();
// ═══════════════════════════════════════════════════════════════════
import { api } from './apiConfig';

const LS = {
  get: (key, fb) => { try { return JSON.parse(localStorage.getItem(key) || 'null') || fb; } catch { return fb; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

// Generic: MongoDB first → cache in localStorage → fallback to localStorage if offline
const loadFromDB = async (apiPath, lsKey, fallback = []) => {
  try {
    const res = await fetch(api(apiPath));
    if (res.ok) {
      const data = await res.json();
      if (data && (Array.isArray(data) ? data.length > 0 : true)) {
        LS.set(lsKey, data);
        return data;
      }
    }
  } catch (e) {
    console.log(`⚡ Offline — using cache for ${lsKey}`);
  }
  return LS.get(lsKey, fallback);
};

const saveToDB = async (apiPath, data, lsKey, method = 'POST') => {
  // Save to localStorage immediately (fast UI)
  if (lsKey) LS.set(lsKey, data);
  // Then sync to MongoDB
  try {
    await fetch(api(apiPath), {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return true;
  } catch (e) {
    console.log(`⚡ Offline — saved to cache only: ${lsKey}`);
    return false;
  }
};

export const dataService = {
  customers: {
    load: () => loadFromDB('/api/customers', 'sharedCustomerData', []),
    save: (data) => saveToDB('/api/customers', data, 'sharedCustomerData'),
    saveOne: (c) => saveToDB('/api/customers', c, null),
  },
  invoices: {
    load: async () => {
      const dbInv = await loadFromDB('/api/invoices', '_dbInvoices', []);
      const lsInv = LS.get('invoices', []);
      const genInv = LS.get('generatedInvoices', []);
      // Merge all sources, deduplicate by invoiceNumber
      const all = [...dbInv, ...lsInv, ...genInv];
      const seen = new Set();
      return all.filter(i => {
        const k = String(i.invoiceNumber || i.id || i._id || Math.random());
        if (seen.has(k)) return false; seen.add(k); return true;
      });
    },
    saveOne: (inv) => saveToDB('/api/invoices', inv, null),
    saveAll: (list) => { LS.set('invoices', list); },
  },
  parts: {
    load: () => loadFromDB('/api/parts', 'partsInventory', []),
    saveOne: (p) => saveToDB('/api/parts', p, null),
  },
  staff: {
    load: () => loadFromDB('/api/staff', 'staffData', []),
    sync: (list) => saveToDB('/api/staff/sync', { staffList: list }, 'staffData'),
  },
  quotations: {
    load: () => loadFromDB('/api/quotations', 'quotations', []),
    sync: (list) => saveToDB('/api/quotations/sync', { quotations: list }, 'quotations'),
    saveOne: (q) => saveToDB('/api/quotations', q, null),
  },
  oldBikes: {
    load: () => loadFromDB('/api/oldbikes', 'oldBikeData', []),
    sync: (list) => saveToDB('/api/oldbikes/sync', { bikes: list }, 'oldBikeData'),
  },
  vehicles: {
    load: async () => {
      // Vehicles come from customers API
      const customers = await loadFromDB('/api/customers', 'sharedCustomerData', []);
      const veh = customers.map(c => ({
        id: c._id || c.id,
        customerName: c.customerName || c.name || '',
        fatherName: c.fatherName || '',
        mobileNo: c.phone || c.mobileNo || '',
        address: c.address || '',
        dist: c.district || '',
        vehicleModel: c.vehicleModel || '',
        color: c.vehicleColor || c.color || '',
        engineNo: c.engineNo || '',
        chassisNo: c.chassisNo || c.frameNo || '',
        regNo: c.registrationNo || c.regNo || '',
        date: c.invoiceDate || c.date || '',
        financerName: c.financeCompany || c.financerName || '',
        aadharNo: c.aadhar || c.aadharNo || '',
        panNo: c.pan || c.panNo || '',
        dob: c.dob || '',
      }));
      if (veh.length > 0) {
        LS.set('vehDashboardData', veh);
        LS.set('vehDashboardModels', [...new Set(veh.map(v => v.vehicleModel))].filter(Boolean));
      }
      return veh;
    },
  },
  // Utility
  ls: LS,
};

export default dataService;
