// ════════════════════════════════════════════════════════════════════════════
// src/main.jsx — VP Honda PWA entry point
// ⚠️ FIX: पहले यहाँ `import App from './app.jsx'` (छोटा a) लिखा था, जबकि
// repo में file का नाम `App.jsx` (बड़ा A) है. Windows पर दोनों एक ही माने
// जाते हैं, पर Vercel (Linux) पर नहीं — वहाँ build "Could not resolve
// ./app.jsx" पर रुक जाता था. इसी वजह से कोई नया deploy live नहीं हो रहा था.
//
// install-prompt / update-banner / reminder scheduling — सब registerSW.js में है.
// ════════════════════════════════════════════════════════════════════════════

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// ⭐ PWA Service Worker + install prompt + update banner — सब registerSW में
import { registerServiceWorker } from './registerSW';
// ⭐ offline में लिखा हुआ काम internet आते ही अपने आप भेजने वाली कतार
import { initOfflineQueue } from './utils/offlineQueue';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ⭐ React mount होने के बाद Service Worker register करें
registerServiceWorker();

// ⭐ offline write queue चालू करें (internet आते ही रुका हुआ काम भेज देगी)
initOfflineQueue();
