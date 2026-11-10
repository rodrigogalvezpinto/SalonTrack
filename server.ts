import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './server/routes.js';
import { seedDemoDataIfEmpty } from './server/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  
  // Parse command line arguments if provided (e.g. --port 3000 --host 0.0.0.0)
  const portIndex = process.argv.indexOf('--port');
  const portArg = portIndex !== -1 ? process.argv[portIndex + 1] : undefined;
  // Always prioritize command line --port argument and enforce port 3000 over system 8080
  const PORT = parseInt(portArg || (process.env.PORT && process.env.PORT !== '8080' ? process.env.PORT : '3000'), 10);

  const hostIndex = process.argv.indexOf('--host');
  const hostArg = hostIndex !== -1 ? process.argv[hostIndex + 1] : undefined;
  const HOST = hostArg || process.env.HOST || '0.0.0.0';

  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Seed Chilean demo studio data if first time
  seedDemoDataIfEmpty();

  // Mount API endpoints
  app.use('/api', apiRouter);

  if (!isProd) {
    // Development mode: Mount Vite dev server middlewares
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: HOST,
        port: PORT,
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    // Production mode: Serve built static files
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  const server = app.listen(PORT, HOST, () => {
    console.log(`✨ SalonTrack Server running on http://${HOST}:${PORT} [${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}]`);
    console.log(`🇨🇱 Región: Chile | Zona Horaria: America/Santiago | Moneda: CLP ($)`);
  });

  process.on('SIGTERM', () => {
    server.close();
  });
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
