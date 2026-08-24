// ════════════════════════════════════════════════════════════════════════════
// src/main.jsx — VP Honda PWA entry point
// ⚠️ FIX: पहले यहाँ और registerSW.js दोनों में एक ही install-prompt का code था
// (दो beforeinstallprompt listener + दो #vp-install-hint banner). अब सिर्फ
// registerSW.js में है — यह file साफ़ रखी गई है.
// ════════════════════════════════════════════════════════════════════════════

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app.jsx';
import './index.css';

// ⭐ PWA Service Worker + install prompt + reminder scheduling — सब registerSW में
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
