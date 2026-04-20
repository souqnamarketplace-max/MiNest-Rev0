import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Register service worker for PWA (delayed to avoid auth lock conflicts)
if ('serviceWorker' in navigator) {
  // Wait 3s after page load to avoid competing with Supabase auth navigator.locks
  window.addEventListener('load', () => {
    setTimeout(() => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('[PWA] SW registered', reg.scope))
        .catch(err => console.warn('[PWA] SW failed:', err));
    }, 3000);
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
