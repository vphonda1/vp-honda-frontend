// ════════════════════════════════════════════════════════════════════════════
// vehicleIdentity.js — गाड़ी की पहचान + डुप्लिकेट record जोड़ने वाला logic
// ════════════════════════════════════════════════════════════════════════════
// समस्या जो यह file हल करती है:
//
// `servicedatas` collection की key `regNo` है — पर उसमें तीन तरह की keys घुस
// गई हैं और एक ही गाड़ी के 3-3 record बन गए:
//
//   MP04YZ0219                  ← असली registration number
//   imported-1781592279008      ← Excel/PDF import के वक़्त बना नक़ली key
//   69df9c0ef0cae6d3251ed6f4    ← MongoDB ObjectId जो गलती से regNo में चला गया
//   69EC60DF7817E0412E38CBB3    ← वही ObjectId, बस बड़े अक्षरों में (case bug)
//
// नतीजा: RemindersPage हर key के लिए अलग reminder बनाता था — इसलिए एक ही
// ग्राहक की एक ही सर्विस के तीन reminder और तीन notification.
//
// यहाँ का हल:
//   1. हर key को uppercase + trim करो (case वाला duplicate ख़त्म)
//   2. पहचानो कि key असली reg no है या कचरा
//   3. फ़ोन नंबर + गाड़ी के आधार पर एक ही गाड़ी के records जोड़ दो, असली reg no
//      वाले record को मुख्य मानकर
// ════════════════════════════════════════════════════════════════════════════

/** key को एक ही रूप में लाओ — `69ec60df…` और `69EC60DF…` अब एक ही हैं */
export const normKey = (k) => String(k || '').trim().toUpperCase();

/** भारतीय registration number जैसा दिखता है? जैसे MP04YZ0219, MP-04-ZY-0219 */
const REG_RE = /^[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{0,3}[\s-]?\d{1,4}$/;

/** 24 अक्षर का hex = MongoDB ObjectId, reg no नहीं */
const OBJECTID_RE = /^[0-9A-F]{24}$/;

/**
 * यह key असली गाड़ी नंबर है या सिर्फ़ जगह भरने वाला कचरा?
 * कचरा: imported-*, ObjectId, no_reg_*, TEMP-*, खाली, —, -
 */
export const isRealRegNo = (k) => {
  const s = normKey(k);
  if (!s || s === '—' || s === '-' || s === 'N/A' || s === 'NA') return false;
  if (s.startsWith('IMPORTED-') || s.startsWith('NO_REG_') || s.startsWith('TEMP-') || s.startsWith('AUTO-')) return false;
  if (OBJECTID_RE.test(s)) return false;
  if (/^\d+$/.test(s)) return false;              // सिर्फ़ अंक = timestamp वग़ैरह
  return REG_RE.test(s.replace(/[\s-]/g, '').replace(/(.{2})(\d{1,2})/, '$1$2'))
      || REG_RE.test(s);
};

/** phone में से आख़िरी 10 अंक — पहचान के लिए सबसे भरोसेमंद चीज़ */
export const phoneKey = (p) => String(p || '').replace(/\D/g, '').slice(-10);

/** नाम को मिलान लायक बनाओ: "479 HARSH MEENA" → "harshmeena" */
export const nameKey = (n) => String(n || '')
  .replace(/^\d+\s*/, '')          // शुरू का serial number हटाओ
  .toLowerCase()
  .replace(/[^a-z\u0900-\u097F]/g, '');

/**
 * एक record किस "असली गाड़ी" का है — इसका fingerprint.
 * असली reg no हो तो वही पहचान है. वरना phone + गाड़ी का मॉडल.
 */
export const identityOf = (rec) => {
  const reg = normKey(rec.regNo);
  if (isRealRegNo(reg)) return `REG:${reg}`;
  const ph = phoneKey(rec.phone);
  const vh = String(rec.vehicle || '').toLowerCase().replace(/\s+/g, '');
  if (ph) return `PH:${ph}|${vh}`;
  const nm = nameKey(rec.customerName);
  if (nm) return `NM:${nm}|${vh}`;
  return `KEY:${reg}`;              // कुछ नहीं मिला तो अपनी ही key
};

/** किस record में ज़्यादा असली जानकारी भरी है? */
const richness = (rec) => {
  let n = 0;
  for (const [k, v] of Object.entries(rec || {})) {
    if (k === 'regNo' || k === 'reminderState') continue;
    if (v !== undefined && v !== null && v !== '' && v !== 0) n++;
  }
  return n;
};

/** दो तारीख़ों में जो नई हो */
const newerDate = (a, b) => {
  if (!a) return b; if (!b) return a;
  const da = new Date(a), db = new Date(b);
  if (isNaN(da)) return b; if (isNaN(db)) return a;
  return db > da ? b : a;
};

const DATE_FIELDS = new Set([
  'purchaseDate','firstServiceDate','secondServiceDate','thirdServiceDate',
  'fourthServiceDate','fifthServiceDate','sixthServiceDate','seventhServiceDate',
  'insuranceDate','rtoDoneDate','insuranceStartDate','insuranceRenewalDate','paymentReceivedDate',
]);

/**
 * पूरे customerServiceData map को साफ़ करो.
 *
 * लौटाता है:
 *   { clean, merges, junkKeys }
 *   clean    — एक गाड़ी = एक record वाला साफ़ map
 *   merges   — [{ keep, dropped:[...], name, vehicle }] — किसे किसमें जोड़ा
 *   junkKeys — जिन keys का reg no असली नहीं है
 *
 * ⚠️ यह किसी की जानकारी मिटाता नहीं — सारे records के fields जोड़कर एक में
 *    रखता है. तारीख़ों में हमेशा नई तारीख़ जीतती है, ताकि कोई हुई सर्विस छूटे नहीं.
 */
export const consolidateServiceData = (sdMap) => {
  const buckets = new Map();

  for (const [rawKey, rawRec] of Object.entries(sdMap || {})) {
    const key = normKey(rawKey);
    if (!key || key === 'NO_REG_') continue;
    const rec = { ...rawRec, regNo: key };
    const id  = identityOf(rec);
    if (!buckets.has(id)) buckets.set(id, []);
    buckets.get(id).push({ key, rec });
  }

  // ── दूसरा दौर: कचरा-key वाले bucket को उसी ग्राहक के असली reg no वाले
  //    bucket में मिलाओ (phone + गाड़ी दोनों मिलें तभी, और तभी जब सिर्फ़ एक ही
  //    असली bucket मिले — दो मिलें तो छेड़ो मत, ग़लत जुड़ने से बेहतर अलग रहना).
  //
  //    यही वह क़दम है जिससे HARSH MEENA का MP04YZ0219 और उसके दो
  //    "imported-…" record एक हो जाते हैं.
  const regBuckets = [...buckets.entries()].filter(([id]) => id.startsWith('REG:'));
  for (const [id, list] of [...buckets.entries()]) {
    if (id.startsWith('REG:')) continue;
    const sample = list[0].rec;
    const ph = phoneKey(sample.phone);
    if (!ph) continue;
    const vh = String(sample.vehicle || '').toLowerCase().replace(/\s+/g, '');
    const hits = regBuckets.filter(([, rl]) => {
      const r = rl[0].rec;
      if (phoneKey(r.phone) !== ph) return false;
      const rv = String(r.vehicle || '').toLowerCase().replace(/\s+/g, '');
      return !vh || !rv || rv === vh;      // गाड़ी लिखी न हो तो phone ही काफ़ी
    });
    if (hits.length === 1) {
      hits[0][1].push(...list);
      buckets.delete(id);
    }
  }

  const clean = {};
  const merges = [];
  const junkKeys = [];

  for (const [, list] of buckets) {
    // मुख्य record चुनो: पहले असली reg no वाला, फिर सबसे भरा-पूरा
    list.sort((a, b) => {
      const ra = isRealRegNo(a.key) ? 1 : 0, rb = isRealRegNo(b.key) ? 1 : 0;
      if (ra !== rb) return rb - ra;
      return richness(b.rec) - richness(a.rec);
    });

    const primary = list[0];
    const merged  = { ...primary.rec, regNo: primary.key };

    for (let i = 1; i < list.length; i++) {
      const other = list[i].rec;
      for (const [f, v] of Object.entries(other)) {
        if (v === undefined || v === null || v === '') continue;
        if (f === 'regNo') continue;
        if (f === 'reminderState') {
          merged.reminderState = { ...(other.reminderState || {}), ...(merged.reminderState || {}) };
          continue;
        }
        if (DATE_FIELDS.has(f)) { merged[f] = newerDate(merged[f], v); continue; }
        if (f === 'pendingAmount') { merged[f] = Math.max(Number(merged[f] || 0), Number(v || 0)); continue; }
        if (merged[f] === undefined || merged[f] === '' || merged[f] === null) merged[f] = v;
      }
    }

    if (list.length > 1) {
      merges.push({
        keep: primary.key,
        dropped: [...new Set(list.slice(1).map(x => x.key))],
        name: merged.customerName || '—',
        vehicle: merged.vehicle || '',
        phone: merged.phone || '',
      });
    }
    if (!isRealRegNo(primary.key)) junkKeys.push(primary.key);
    clean[primary.key] = merged;
  }

  return { clean, merges, junkKeys };
};

/**
 * बने हुए reminders में से एक ही चीज़ दोबारा हटाओ.
 * fingerprint = किस गाड़ी का + किस तरह का + कौन सी सर्विस + कब due.
 * असली reg no वाला reminder जीतता है.
 */
export const dedupeReminders = (list) => {
  const seen = new Map();
  for (const r of list) {
    const due = r.dueDate instanceof Date && !isNaN(r.dueDate) ? r.dueDate.toISOString().slice(0, 10) : 'nodate';
    const who = phoneKey(r.customerPhone) || nameKey(r.customerName);
    const fp  = `${who}|${r.type}|${r.serviceType || ''}|${due}`;
    const prev = seen.get(fp);
    if (!prev) { seen.set(fp, r); continue; }
    // असली reg no वाले को रखो; बराबर हों तो जिसमें call log ज़्यादा हो
    const better = isRealRegNo(r.regNo) && !isRealRegNo(prev.regNo) ? r
                 : isRealRegNo(prev.regNo) && !isRealRegNo(r.regNo) ? prev
                 : (r.callCount || 0) > (prev.callCount || 0) ? r : prev;
    const other = better === r ? prev : r;
    // हटाए जा रहे record की जानकारी न खोए
    better.mergedFrom = [...(better.mergedFrom || []), other.regNo].filter(Boolean);
    seen.set(fp, better);
  }
  return [...seen.values()];
};

/** UI में दिखाने लायक गाड़ी नंबर — कचरा key की जगह साफ़ शब्द */
export const displayRegNo = (regNo, vehicle) => {
  if (isRealRegNo(regNo)) return normKey(regNo);
  return vehicle ? `${vehicle} · नंबर दर्ज नहीं` : 'नंबर दर्ज नहीं';
};
