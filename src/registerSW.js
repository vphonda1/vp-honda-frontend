// ════════════════════════════════════════════════════════════════════════════
// VP Honda PWA — Service Worker Registration
// Add this to your src/main.jsx or App.jsx
// ════════════════════════════════════════════════════════════════════════════

export const registerServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          console.log('✅ VP Honda PWA Service Worker registered:', registration.scope);

          // Check for updates every 60 seconds when app is open
          setInterval(() => {
            registration.update().catch(() => {});
          }, 60000);

          // When a new SW is found, prompt user to refresh
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Notify user about update
                showUpdateNotification(registration);
              }
            });
          });
        })
        .catch((error) => {
          console.warn('Service Worker registration failed:', error);
        });

      // Reload page when new SW takes over (for clean state)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    });
  }
};

// ═══ Update Notification UI ═══
function showUpdateNotification(registration) {
  // Check if banner already exists
  if (document.getElementById('vp-update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'vp-update-banner';
  banner.innerHTML = `
    <div style="
      position: fixed;
      bottom: 16px;
      left: 16px;
      right: 16px;
      max-width: 400px;
      margin: 0 auto;
      background: linear-gradient(135deg, #DC0000, #B91C1C);
      color: white;
      padding: 14px 18px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(220,0,0,0.4);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      animation: vp-slide-up 0.3s ease;
    ">
      <div style="font-size: 24px;">🔄</div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 700; font-size: 14px;">नया Update उपलब्ध है!</div>
        <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">Latest features और bug fixes के लिए reload करें</div>
      </div>
      <button id="vp-update-btn" style="
        background: white;
        color: #DC0000;
        border: none;
        padding: 8px 14px;
        border-radius: 8px;
        font-weight: 700;
        cursor: pointer;
        font-size: 13px;
        white-space: nowrap;
      ">Update करें</button>
      <button id="vp-update-dismiss" style="
        background: transparent;
        color: white;
        border: 1px solid rgba(255,255,255,0.4);
        padding: 8px 10px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
      ">×</button>
    </div>
    <style>
      @keyframes vp-slide-up {
        from { transform: translateY(100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    </style>
  `;
  document.body.appendChild(banner);

  document.getElementById('vp-update-btn').addEventListener('click', () => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    banner.remove();
  });

  document.getElementById('vp-update-dismiss').addEventListener('click', () => {
    banner.remove();
  });
}