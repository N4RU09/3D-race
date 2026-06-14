import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

// Import our serverless express handlers so they also run in local dev!
import tracksApp from './api/tracks';
import playersApp from './api/players';
import dbStatusApp from './api/db-status';
import recordsApp from './api/records';
import multiplayerApp from './api/multiplayer';

function localApiServerPlugin(): Plugin {
  return {
    name: 'local-api-server-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        
        // Match base routes and delegate requests to respective express app handlers
        if (url.startsWith('/api/tracks')) {
          tracksApp(req as any, res as any, next);
        } else if (url.startsWith('/api/players')) {
          playersApp(req as any, res as any, next);
        } else if (url.startsWith('/api/db-status')) {
          dbStatusApp(req as any, res as any, next);
        } else if (url.startsWith('/api/records')) {
          recordsApp(req as any, res as any, next);
        } else if (url.startsWith('/api/multiplayer')) {
          multiplayerApp(req as any, res as any, next);
        } else {
          next();
        }
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), localApiServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000, // Port MUST be 3000 as per infrastructure requirements
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
