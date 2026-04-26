// ════════════════════════════════════════════════════════════════════════════
// src/main.jsx — VP Honda PWA entry point
// Add this code to your existing main.jsx (or replace it entirely)
// ════════════════════════════════════════════════════════════════════════════

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app.jsx';
import './index.css';

// ⭐ Register PWA Service Worker
import { registerServiceWorker } from './registerSW';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ⭐ Register Service Worker AFTER React mounts
registerServiceWorker();

// ⭐ Optional: Add install prompt UI
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  console.log('💡 PWA install available');

  // Show subtle install hint after 30 seconds
  setTimeout(() => showInstallHint(), 30000);
});

window.addEventListener('appinstalled', () => {
  console.log('✅ VP Honda installed successfully');
  deferredInstallPrompt = null;
  hideInstallHint();
});

function showInstallHint() {
  if (!deferredInstallPrompt) return;
  if (document.getElementById('vp-install-hint')) return;

  // Don't show if user already dismissed in last 7 days
  const dismissed = localStorage.getItem('vp_install_dismissed');
  if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

  const hint = document.createElement('div');
  hint.id = 'vp-install-hint';
  hint.innerHTML = `
    <div style="
      position: fixed;
      bottom: 16px;
      left: 16px;
      right: 16px;
      max-width: 360px;
      margin: 0 auto;
      background: linear-gradient(135deg, #DC0000, #B91C1C);
      color: white;
      padding: 14px;
      border-radius: 14px;
      box-shadow: 0 10px 40px rgba(220,0,0,0.4);
      z-index: 9998;
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: -apple-system, sans-serif;
      animation: vp-slide-in 0.4s ease;
    ">
      <div style="font-size: 32px;">📱</div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 800; font-size: 14px;">VP Honda को Install करें</div>
        <div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">Phone पर Real App की तरह use करें</div>
      </div>
      <button id="vp-install-yes" style="
        background: white; color: #DC0000;
        border: none; padding: 8px 14px;
        border-radius: 8px; font-weight: 800;
        font-size: 13px; cursor: pointer;
      ">Install</button>
      <button id="vp-install-no" style="
        background: transparent; color: white;
        border: 1px solid rgba(255,255,255,0.4);
        padding: 8px 10px; border-radius: 8px;
        cursor: pointer; font-size: 13px;
      ">×</button>
    </div>
    <style>
      @keyframes vp-slide-in {
        from { transform: translateY(100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    </style>
  `;
  document.body.appendChild(hint);

  document.getElementById('vp-install-yes').addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      console.log('Install outcome:', outcome);
      deferredInstallPrompt = null;
    }
    hideInstallHint();
  });

  document.getElementById('vp-install-no').addEventListener('click', () => {
    localStorage.setItem('vp_install_dismissed', Date.now().toString());
    hideInstallHint();
  });
}

function hideInstallHint() {
  const hint = document.getElementById('vp-install-hint');
  if (hint) hint.remove();
}