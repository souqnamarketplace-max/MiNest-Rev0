import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Initialize error tracking (only loads when VITE_SENTRY_DSN is set)
import { initSentry } from '@/lib/sentry';
initSentry();

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
