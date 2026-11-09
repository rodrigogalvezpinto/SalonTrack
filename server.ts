import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from './server/app.js';
import { bootstrapDatabase } from './server/bootstrap.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const config = bootstrapDatabase();
  const app = createApp();
  const PORT = config.port;

  if (!config.isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✨ SalonTrack Server running on http://0.0.0.0:${PORT} [${config.isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}]`);
    console.log(`🗄️  SQLite: ${config.databaseFile} | Pagos: ${config.paymentProvider} | Email: ${config.emailProvider}`);
    console.log(`🇨🇱 Región: Chile | Zona Horaria: America/Santiago | Moneda: CLP ($)`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
