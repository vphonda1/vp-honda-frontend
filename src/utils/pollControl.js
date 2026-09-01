// ════════════════════════════════════════════════════════════════════════════
// pollControl.js — Render का कोटा बचाने वाला साझा नियंत्रण
// ════════════════════════════════════════════════════════════════════════════
// समस्या:
//   Render की free service 15 मिनट ख़ामोशी पर सो जाती है, और सोते वक़्त घंटे
//   नहीं कटते. पर app के 17 setInterval में से एक में भी `document.hidden`
//   की जाँच नहीं थी — यानी tab पीछे चला जाए, laptop बंद हो, फ़ोन जेब में हो,
//   तब भी request जाती रहती थीं. इसलिए service कभी सोती ही नहीं थी और
//   दुकान के 11 घंटे नहीं, पूरे 24 घंटे कटते थे.
//
// ⚠️ ज़रूरी समझ:
//   सिर्फ़ अंतराल बढ़ाने (3s → 30s) से कोटा नहीं बचता! Render request की
//   *गिनती* नहीं, *जागे रहने का समय* गिनता है. 30 सेकंड भी 15 मिनट से कम है,
//   इसलिए service फिर भी जागी रहेगी.
//   असली बचत `document.hidden` से होती है — tab पीछे जाते ही request पूरी
//   तरह रुकें, तभी 15 मिनट बाद Render सो पाएगा.
// ════════════════════════════════════════════════════════════════════════════

/**
 * setInterval का ऐसा रूप जो tab पीछे जाते ही रुक जाता है और सामने आते ही
 * एक बार तुरंत चलकर दोबारा शुरू हो जाता है.
 *
 * इस्तेमाल — useEffect के अंदर:
 *     useEffect(() => visibleInterval(loadData, 60000), []);
 *
 * यह ख़ुद cleanup function लौटाता है, इसलिए clearInterval भूलना असंभव है.
 *
 * @param {Function} fn         जो चलाना है
 * @param {number}   ms         कितने milliseconds में एक बार
 * @param {object}   opts
 * @param {boolean}  opts.runNow      शुरू में एक बार तुरंत चलाएँ? (default: नहीं)
 * @param {Function} opts.enabled     () => boolean — false हो तो कुछ न चले
 * @returns {Function} cleanup
 */
export function visibleInterval(fn, ms, opts = {}) {
  const { runNow = false, enabled } = opts;
  let timer = null;
  let stopped = false;

  const allowed = () => !stopped && (!enabled || enabled());

  const tick = () => { if (allowed() && !document.hidden) { try { fn(); } catch (e) { console.warn('[poll]', e); } } };

  const start = () => {
    if (timer || !allowed()) return;
    timer = setInterval(tick, ms);
  };

  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

  const onVisibility = () => {
    if (document.hidden) {
      stop();                       // ⬅️ यहीं कोटा बचता है
    } else {
      tick();                       // वापस आते ही एक बार ताज़ा कर दो
      start();
    }
  };

  document.addEventListener('visibilitychange', onVisibility);

  if (!document.hidden) {
    if (runNow) tick();
    start();
  }

  return () => {
    stopped = true;
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Team Chat का master switch
// ════════════════════════════════════════════════════════════════════════════
// Chat हर 3 सेकंड server से पूछता था — अकेले 26,400 request रोज़. जब तक एक
// tab chat पर खुला रहे, Render रातभर जागी रहती थी.
//
// अब chat **बंद रहता है**. ज़रूरत हो तो बटन दबाकर चालू, काम ख़त्म होते ही
// बंद. बंद हालत में एक भी request नहीं जाती — पूरी तरह leak-free.
const CHAT_KEY = 'vp_chat_enabled';

export const isChatOn = () => {
  try { return localStorage.getItem(CHAT_KEY) === '1'; } catch { return false; }
};

export const setChatOn = (on) => {
  try { localStorage.setItem(CHAT_KEY, on ? '1' : '0'); } catch {}
  try { window.dispatchEvent(new CustomEvent('vp-chat-toggle', { detail: !!on })); } catch {}
};

/** chat कितनी देर बाद अपने आप बंद हो जाए (कोई message न आए तो) */
export const CHAT_IDLE_OFF_MS = 10 * 60 * 1000;   // 10 मिनट

/** chat चालू हो तो कितने सेकंड में एक बार पूछे */
export const CHAT_POLL_MS = 25000;                // 25 सेकंड
