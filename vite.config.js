import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'

// Plugin to inject env vars into the Firebase service worker at build time
function firebaseSwPlugin() {
  return {
    name: 'firebase-sw-env',
    writeBundle() {
      const swTemplate = path.resolve(__dirname, 'src/firebase-messaging-sw.js');
      const swOutput = path.resolve(__dirname, 'dist/firebase-messaging-sw.js');
      if (!fs.existsSync(swTemplate)) return;

      let content = fs.readFileSync(swTemplate, 'utf-8');
      const replacements = {
        '__FIREBASE_API_KEY__': process.env.VITE_FIREBASE_API_KEY || '',
        '__FIREBASE_AUTH_DOMAIN__': process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
        '__FIREBASE_PROJECT_ID__': process.env.VITE_FIREBASE_PROJECT_ID || '',
        '__FIREBASE_STORAGE_BUCKET__': process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
        '__FIREBASE_MESSAGING_SENDER_ID__': process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
        '__FIREBASE_APP_ID__': process.env.VITE_FIREBASE_APP_ID || '',
      };
      for (const [key, value] of Object.entries(replacements)) {
        content = content.replace(new RegExp(key, 'g'), value);
      }
      fs.writeFileSync(swOutput, content);
    },
    configureServer(server) {
      // Serve the SW in dev mode with env vars replaced
      server.middlewares.use('/firebase-messaging-sw.js', (req, res) => {
        const swTemplate = path.resolve(__dirname, 'src/firebase-messaging-sw.js');
        if (!fs.existsSync(swTemplate)) { res.statusCode = 404; res.end(); return; }
        let content = fs.readFileSync(swTemplate, 'utf-8');
        const replacements = {
          '__FIREBASE_API_KEY__': process.env.VITE_FIREBASE_API_KEY || '',
          '__FIREBASE_AUTH_DOMAIN__': process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
          '__FIREBASE_PROJECT_ID__': process.env.VITE_FIREBASE_PROJECT_ID || '',
          '__FIREBASE_STORAGE_BUCKET__': process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
          '__FIREBASE_MESSAGING_SENDER_ID__': process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
          '__FIREBASE_APP_ID__': process.env.VITE_FIREBASE_APP_ID || '',
        };
        for (const [key, value] of Object.entries(replacements)) {
          content = content.replace(new RegExp(key, 'g'), value);
        }
        res.setHeader('Content-Type', 'application/javascript');
        res.end(content);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), firebaseSwPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
})
