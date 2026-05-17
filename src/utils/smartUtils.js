// ════════════════════════════════════════════════════════════════════════════
// smartUtils.js — VP Honda Smart Features Helper Library
// ════════════════════════════════════════════════════════════════════════════
// Reusable utilities used across all pages:
// • WhatsApp share (text + PDF)
// • Camera capture (photos)
// • Push notifications
// • Universal search
// • Service/insurance reminders
// • Visitor counter helpers
// ════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────
// 📲 WHATSAPP SHARE
// ──────────────────────────────────────────────────────────────────────────

/**
 * Send a WhatsApp message to a customer
 * @param {string} phone - 10-digit Indian mobile (with or without 91 prefix)
 * @param {string} message - Pre-formatted message
 */
export const sendWhatsApp = (phone, message) => {
  if (!phone) {
    alert('❌ Phone number नहीं है');
    return false;
  }
  // Clean phone: remove spaces, dashes, + sign
  const cleaned = String(phone).replace(/[\s\-+]/g, '');
  // Add 91 prefix if missing
  const final = cleaned.length === 10 ? `91${cleaned}` : cleaned;
  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/${final}?text=${encoded}`;
  window.open(url, '_blank');
  return true;
};

/**
 * Generate Tax Invoice WhatsApp message for customer
 */
export const buildInvoiceWAMessage = (invoice) => {
  const greet = `नमस्ते ${invoice.customerName || 'Customer'} जी 🙏`;
  const body = `
आपकी VP Honda की Tax Invoice तैयार है:

📄 Invoice No: ${invoice.invoiceNumber || '-'}
🏍️ Vehicle: ${invoice.vehicleModel || '-'}
🎨 Color: ${invoice.color || '-'}
🔢 Chassis: ${invoice.chassisNo || '-'}
💰 Total: ₹${(invoice.price || 0).toLocaleString('en-IN')}
📅 Date: ${invoice.invoiceDate || new Date().toLocaleDateString('en-IN')}

धन्यवाद! 🙏
VP Honda, Bhopal
📞 9713394738`;
  return greet + body;
};

/**
 * Service reminder WhatsApp message
 */
export const buildServiceReminderWA = (customer, serviceNo, dueDate) => {
  return `नमस्ते ${customer.name || 'Customer'} जी 🙏

आपकी ${customer.vehicle || 'bike'} की ${serviceNo}${ordinalSuffix(serviceNo)} Free Service ${dueDate ? `${dueDate} को` : 'जल्दी'} due है।

कृपया VP Honda Showroom पर आएं या call करें:
📞 9713394738
📍 Parwaliya Sadak, Bhopal

समय पर service करवाएं — आपकी bike की life बढ़ाएं! 🏍️
- VP Honda Team`;
};

/**
 * Birthday wish WhatsApp message
 */
export const buildBirthdayWA = (customer) => {
  return `🎂 जन्मदिन की हार्दिक शुभकामनाएं ${customer.name || 'Customer'} जी! 🎉

आपके जीवन में खुशियाँ, सेहत और सफलता बनी रहे।

VP Honda की तरफ से special offer:
💝 इस महीने service कराएं — 10% OFF on labour charges

📞 9713394738
- VP Honda Team`;
};

/**
 * Generic helper — quick custom message
 */
export const buildCustomWA = (greeting, body, signoff = '- VP Honda Team') => {
  return `${greeting}\n\n${body}\n\n${signoff}`;
};

const ordinalSuffix = (n) => {
  const num = Number(n);
  if (num === 1) return 'st';
  if (num === 2) return 'nd';
  if (num === 3) return 'rd';
  return 'th';
};

// ──────────────────────────────────────────────────────────────────────────
// 📷 CAMERA CAPTURE
// ──────────────────────────────────────────────────────────────────────────

/**
 * Hidden file input that uses device camera
 * Returns a Promise<base64> of the captured photo
 */
export const captureFromCamera = (facingMode = 'environment') => {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = facingMode;     // 'environment' = back camera, 'user' = front
    input.style.display = 'none';

    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return reject('No photo captured');
      const reader = new FileReader();
      reader.onload = () => {
        // Compress image to ~500KB before storing
        compressImage(reader.result, 1200, 0.7).then(resolve).catch(reject);
      };
      reader.onerror = () => reject('Failed to read photo');
      reader.readAsDataURL(file);
    };

    input.click();
    setTimeout(() => input.remove(), 60000);
  });
};

/**
 * Compress image to reduce size (canvas-based)
 */
export const compressImage = (base64, maxWidth = 1200, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = base64;
  });
};

/**
 * Get human-readable file size from base64
 */
export const getBase64Size = (base64) => {
  if (!base64) return '0 KB';
  const stringLength = base64.length - 'data:image/jpeg;base64,'.length;
  const sizeInBytes = (stringLength * 3) / 4;
  const sizeInKB = sizeInBytes / 1024;
  if (sizeInKB < 1024) return `${Math.round(sizeInKB)} KB`;
  return `${(sizeInKB / 1024).toFixed(1)} MB`;
};

// ──────────────────────────────────────────────────────────────────────────
// 🔔 PUSH NOTIFICATIONS
// ──────────────────────────────────────────────────────────────────────────

/**
 * Request notification permission (call once on app load)
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('Notifications not supported');
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch {
    return false;
  }
};

/**
 * Show a local notification
 */
export const showNotification = (title, body, options = {}) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    // Fallback: in-app toast
    showInAppToast(title, body, options.type || 'info');
    return;
  }
  try {
    const notif = new Notification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      tag: options.tag || 'vp-honda',
      requireInteraction: options.persistent || false,
      ...options,
    });
    if (options.onClick) {
      notif.onclick = options.onClick;
    }
    if (!options.persistent) {
      setTimeout(() => notif.close(), 5000);
    }
  } catch (err) {
    showInAppToast(title, body, options.type || 'info');
  }
};

/**
 * In-app toast notification (fallback)
 */
export const showInAppToast = (title, body, type = 'info') => {
  const colors = {
    info:    { bg: '#1e40af', icon: 'ℹ️' },
    success: { bg: '#16a34a', icon: '✅' },
    warning: { bg: '#ea580c', icon: '⚠️' },
    error:   { bg: '#dc2626', icon: '❌' },
  };
  const c = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${c.bg};
    color: white;
    padding: 14px 18px;
    border-radius: 10px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    z-index: 9999;
    max-width: 360px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-family: -apple-system, sans-serif;
    animation: vp-toast-slide-in 0.3s ease;
  `;
  toast.innerHTML = `
    <div style="font-size:24px; line-height:1;">${c.icon}</div>
    <div style="flex:1; min-width:0;">
      <div style="font-weight:700; font-size:14px;">${title}</div>
      ${body ? `<div style="font-size:12px; opacity:0.9; margin-top:3px;">${body}</div>` : ''}
    </div>
  `;
  if (!document.getElementById('vp-toast-style')) {
    const style = document.createElement('style');
    style.id = 'vp-toast-style';
    style.textContent = `
      @keyframes vp-toast-slide-in { from { transform: translateX(120%); } to { transform: translateX(0); } }
      @keyframes vp-toast-slide-out { to { transform: translateX(120%); opacity: 0; } }
    `;
    document.head.appendChild(style);
  }
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'vp-toast-slide-out 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

// ──────────────────────────────────────────────────────────────────────────
// 🔍 UNIVERSAL SEARCH
// ──────────────────────────────────────────────────────────────────────────

/**
 * Smart search across customers / vehicles / invoices / parts
 * Returns array of matched items with type tag
 */
export const universalSearch = (query, dataSets = {}) => {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase().trim();
  const results = [];

  // Customers
  if (dataSets.customers) {
    dataSets.customers.forEach(c => {
      const matchScore = scoreMatch(q, [
        c.customerName || c.name,
        c.mobileNo || c.phone,
        c.fatherName,
        c.address,
        c.aadhar,
        c.pan,
      ]);
      if (matchScore > 0) {
        results.push({
          type: 'customer',
          icon: '👤',
          title: c.customerName || c.name || 'Unknown',
          subtitle: `📞 ${c.mobileNo || c.phone || '-'} | ${c.address || ''}`,
          data: c,
          score: matchScore,
          link: `/customer-profile/${c._id}`,
        });
      }
    });
  }

  // Vehicles
  if (dataSets.vehicles) {
    dataSets.vehicles.forEach(v => {
      const matchScore = scoreMatch(q, [
        v.customerName,
        v.vehicleModel,
        v.chassisNo,
        v.engineNo,
        v.regNo,
        v.mobileNo,
      ]);
      if (matchScore > 0) {
        results.push({
          type: 'vehicle',
          icon: '🏍️',
          title: `${v.vehicleModel} — ${v.color || ''}`,
          subtitle: `${v.customerName || '-'} | Chassis: ${v.chassisNo || '-'}`,
          data: v,
          score: matchScore,
          link: `/veh-dashboard`,
        });
      }
    });
  }

  // Invoices
  if (dataSets.invoices) {
    dataSets.invoices.forEach(i => {
      const matchScore = scoreMatch(q, [
        i.invoiceNumber,
        i.customerName,
        i.vehicleModel,
        i.chassisNo,
      ]);
      if (matchScore > 0) {
        results.push({
          type: 'invoice',
          icon: '📄',
          title: `Invoice ${i.invoiceNumber || '-'}`,
          subtitle: `${i.customerName} | ₹${(i.price || 0).toLocaleString('en-IN')}`,
          data: i,
          score: matchScore,
          link: `/invoice-management`,
        });
      }
    });
  }

  // Parts
  if (dataSets.parts) {
    dataSets.parts.forEach(p => {
      const matchScore = scoreMatch(q, [
        p.partName,
        p.partNumber,
        p.category,
      ]);
      if (matchScore > 0) {
        results.push({
          type: 'part',
          icon: '🔧',
          title: p.partName || 'Part',
          subtitle: `#${p.partNumber || '-'} | Stock: ${p.stock || 0}`,
          data: p,
          score: matchScore,
          link: `/parts`,
        });
      }
    });
  }

  // Sort by score (highest match first), limit to 20
  return results.sort((a, b) => b.score - a.score).slice(0, 20);
};

const scoreMatch = (query, fields) => {
  let score = 0;
  fields.forEach(field => {
    if (!field) return;
    const f = String(field).toLowerCase();
    if (f === query) score += 100;
    else if (f.startsWith(query)) score += 50;
    else if (f.includes(query)) score += 20;
  });
  return score;
};

// ──────────────────────────────────────────────────────────────────────────
// 📅 SMART REMINDERS HELPERS
// ──────────────────────────────────────────────────────────────────────────

/**
 * Calculate Honda free service due dates from purchase date
 * Honda gives 5 free services typically:
 * - 1st: 750 km / 1 month
 * - 2nd: 4000 km / 6 months
 * - 3rd: 8000 km / 12 months
 * - 4th: 12000 km / 18 months
 * - 5th: 16000 km / 24 months
 */
export const getServiceSchedule = (purchaseDate) => {
  if (!purchaseDate) return [];
  const start = new Date(purchaseDate);
  if (isNaN(start.getTime())) return [];

  return [
    { num: 1, label: '1st Free Service', months: 1, km: 750 },
    { num: 2, label: '2nd Free Service', months: 6, km: 4000 },
    { num: 3, label: '3rd Free Service', months: 12, km: 8000 },
    { num: 4, label: '4th Free Service', months: 18, km: 12000 },
    { num: 5, label: '5th Free Service', months: 24, km: 16000 },
  ].map(s => {
    const due = new Date(start);
    due.setMonth(due.getMonth() + s.months);
    const today = new Date();
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    return {
      ...s,
      dueDate: due.toISOString().split('T')[0],
      dueDateFormatted: due.toLocaleDateString('en-IN'),
      daysRemaining: diffDays,
      isDue: diffDays <= 0,
      isUpcoming: diffDays > 0 && diffDays <= 7,
      status: diffDays <= 0 ? 'overdue' : diffDays <= 7 ? 'upcoming' : 'future',
    };
  });
};

/**
 * Get insurance/PUC expiry alerts
 */
export const checkExpiry = (expiryDate, type = 'Insurance') => {
  if (!expiryDate) return null;
  const due = new Date(expiryDate);
  const today = new Date();
  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { type, status: 'expired', days: Math.abs(diffDays), msg: `${type} expired ${Math.abs(diffDays)} days ago` };
  if (diffDays <= 30) return { type, status: 'expiring', days: diffDays, msg: `${type} expires in ${diffDays} days` };
  return { type, status: 'ok', days: diffDays, msg: `${type} valid` };
};

// ──────────────────────────────────────────────────────────────────────────
// 👥 VISITOR COUNTER & PICKUP-DROP
// ──────────────────────────────────────────────────────────────────────────

/**
 * Save a visitor entry (in localStorage + later sync to MongoDB)
 */
export const recordVisitor = async (visitorData) => {
  const visitor = {
    id: `vis_${Date.now()}`,
    name: visitorData.name || 'Unknown',
    phone: visitorData.phone || '',
    purpose: visitorData.purpose || 'General',  // 'Purchase' | 'Service' | 'Inquiry' | 'General'
    interestedModel: visitorData.interestedModel || '',
    notes: visitorData.notes || '',
    visitTime: new Date().toISOString(),
    handledBy: visitorData.handledBy || '',
    converted: false,                             // बना customer या नहीं
    ...visitorData,
  };

  // Save locally
  const existing = JSON.parse(localStorage.getItem('vp_visitors') || '[]');
  existing.unshift(visitor);
  localStorage.setItem('vp_visitors', JSON.stringify(existing.slice(0, 500)));  // keep last 500

  return visitor;
};

/**
 * Get visitor stats for dashboard
 */
export const getVisitorStats = () => {
  const visitors = JSON.parse(localStorage.getItem('vp_visitors') || '[]');
  const today = new Date().toISOString().split('T')[0];
  const todayVisitors = visitors.filter(v => v.visitTime?.startsWith(today));
  const last7Days = visitors.filter(v => {
    const days = (Date.now() - new Date(v.visitTime).getTime()) / (1000 * 60 * 60 * 24);
    return days <= 7;
  });
  const last30Days = visitors.filter(v => {
    const days = (Date.now() - new Date(v.visitTime).getTime()) / (1000 * 60 * 60 * 24);
    return days <= 30;
  });

  // Conversion rate
  const converted30 = last30Days.filter(v => v.converted).length;
  const conversionRate = last30Days.length > 0
    ? Math.round((converted30 / last30Days.length) * 100)
    : 0;

  return {
    today: todayVisitors.length,
    last7Days: last7Days.length,
    last30Days: last30Days.length,
    total: visitors.length,
    conversionRate,
    purchase: todayVisitors.filter(v => v.purpose === 'Purchase').length,
    service: todayVisitors.filter(v => v.purpose === 'Service').length,
    inquiry: todayVisitors.filter(v => v.purpose === 'Inquiry').length,
    general: todayVisitors.filter(v => v.purpose === 'General').length,
  };
};

/**
 * Pickup-Drop Service Tracking
 */
export const recordPickupDrop = async (data) => {
  const entry = {
    id: `pd_${Date.now()}`,
    customerId: data.customerId || '',
    customerName: data.customerName || '',
    customerPhone: data.customerPhone || '',
    vehicleRegNo: data.vehicleRegNo || '',
    vehicleModel: data.vehicleModel || '',
    type: data.type || 'pickup',                  // 'pickup' | 'drop'
    pickupAddress: data.pickupAddress || '',
    pickupTime: data.pickupTime || new Date().toISOString(),
    pickupLat: data.pickupLat || null,
    pickupLng: data.pickupLng || null,
    dropAddress: data.dropAddress || '',
    dropTime: data.dropTime || null,
    dropLat: data.dropLat || null,
    dropLng: data.dropLng || null,
    handledBy: data.handledBy || '',
    status: data.status || 'scheduled',           // 'scheduled' | 'in-transit' | 'completed' | 'cancelled'
    notes: data.notes || '',
    photos: data.photos || [],                     // [base64Photo, ...]
    serviceLinkId: data.serviceLinkId || '',      // link to service entry
  };

  const existing = JSON.parse(localStorage.getItem('vp_pickup_drops') || '[]');
  existing.unshift(entry);
  localStorage.setItem('vp_pickup_drops', JSON.stringify(existing.slice(0, 200)));

  return entry;
};

/**
 * Get pickup-drop stats
 */
export const getPickupDropStats = () => {
  const list = JSON.parse(localStorage.getItem('vp_pickup_drops') || '[]');
  const today = new Date().toISOString().split('T')[0];
  const todayItems = list.filter(p => p.pickupTime?.startsWith(today));

  return {
    total: list.length,
    today: todayItems.length,
    pending: list.filter(p => p.status === 'scheduled').length,
    inTransit: list.filter(p => p.status === 'in-transit').length,
    completed: list.filter(p => p.status === 'completed').length,
    todayPickups: todayItems.filter(p => p.type === 'pickup').length,
    todayDrops: todayItems.filter(p => p.type === 'drop').length,
  };
};

/**
 * Update pickup-drop status (in-transit -> completed)
 */
export const updatePickupDrop = (id, updates) => {
  const list = JSON.parse(localStorage.getItem('vp_pickup_drops') || '[]');
  const idx = list.findIndex(p => p.id === id);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
  localStorage.setItem('vp_pickup_drops', JSON.stringify(list));
  return list[idx];
};

// ──────────────────────────────────────────────────────────────────────────
// 📍 GEOLOCATION HELPER
// ──────────────────────────────────────────────────────────────────────────

export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject('Location not supported');
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (err) => reject(err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
};

// ──────────────────────────────────────────────────────────────────────────
// 🎯 EXPORT ALL
// ──────────────────────────────────────────────────────────────────────────

export default {
  // WhatsApp
  sendWhatsApp,
  buildInvoiceWAMessage,
  buildServiceReminderWA,
  buildBirthdayWA,
  buildCustomWA,
  // Camera
  captureFromCamera,
  compressImage,
  getBase64Size,
  // Notifications
  requestNotificationPermission,
  showNotification,
  showInAppToast,
  // Search
  universalSearch,
  // Reminders
  getServiceSchedule,
  checkExpiry,
  // Visitors
  recordVisitor,
  getVisitorStats,
  // Pickup-Drop
  recordPickupDrop,
  getPickupDropStats,
  updatePickupDrop,
  // Location
  getCurrentLocation,
};
              
