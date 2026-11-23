import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { expireStalePendingBookings } from './server/bookingExpiration.js';
import apiRouter from './server/routes.js';
import { seedDemoDataIfEmpty } from './server/auth.js';
import { emailConfigured } from './server/adapters/email.js';
import { mercadoPagoConfigured } from './server/adapters/mercadoPago.js';
import { securityHeadersMiddleware } from './server/securityHeaders.js';
import { closeSqliteDb } from './server/sqlite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEVELOPMENT_JWT_SECRET = 'salontrack_dev_secret_chile_2026';

async function startServer() {
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.JWT_SECRET ||
      process.env.JWT_SECRET.length < 32 ||
      process.env.JWT_SECRET === DEVELOPMENT_JWT_SECRET)
  ) {
    throw new Error('Production requires a JWT_SECRET of at least 32 characters that is not the development default.');
  }
  if (process.env.NODE_ENV === 'production' && !emailConfigured()) {
    console.warn('Correo transaccional no configurado: configure RESEND_API_KEY y RESEND_FROM_EMAIL para habilitar la recuperación de contraseña.');
  }
  if (process.env.NODE_ENV === 'production' && !mercadoPagoConfigured()) {
    console.warn('Mercado Pago no está configurado: configure las credenciales de acceso y firma para habilitar pagos de suscripción.');
  }

  const app = express();
  app.disable('x-powered-by');
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy !== undefined) {
    const trimmedTrustProxy = trustProxy.trim();
    const numericTrustProxy = Number(trimmedTrustProxy);
    if (trustProxy === 'true') {
      app.set('trust proxy', true);
    } else if (trimmedTrustProxy !== '' && Number.isFinite(numericTrustProxy)) {
      app.set('trust proxy', numericTrustProxy);
    } else {
      app.set('trust proxy', trustProxy);
    }
  }
  app.use(securityHeadersMiddleware);
  
  // Parse command line arguments if provided (e.g. --port 3000 --host 0.0.0.0)
  const portIndex = process.argv.indexOf('--port');
  const portArg = portIndex !== -1 ? process.argv[portIndex + 1] : undefined;
  const isProd = process.env.NODE_ENV === 'production';
  const defaultPort = isProd
    ? process.env.PORT || '3000'
    : process.env.PORT && process.env.PORT !== '8080' ? process.env.PORT : '3000';
  const PORT = parseInt(portArg || defaultPort, 10);

  const hostIndex = process.argv.indexOf('--host');
  const hostArg = hostIndex !== -1 ? process.argv[hostIndex + 1] : undefined;
  const HOST = hostArg || process.env.HOST || '0.0.0.0';

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Seed Chilean demo studio data if first time
  seedDemoDataIfEmpty();

  const expirePendingBookings = () => {
    try {
      expireStalePendingBookings();
    } catch (err) {
      console.error('Error al expirar reservas pendientes:', err);
    }
  };
  expirePendingBookings();
  setInterval(expirePendingBookings, 15 * 60 * 1000).unref();

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

    const dataDir = path.resolve(__dirname, 'data');
    app.use((req, res, next) => {
      let requestPath = req.path;
      try {
        requestPath = decodeURIComponent(req.path);
      } catch {}
      const fsPath = requestPath.startsWith('/@fs/') ? requestPath.slice(4) : path.join(__dirname, requestPath);
      const resolved = path.resolve(fsPath);
      if (resolved === dataDir || resolved.startsWith(dataDir + path.sep)) {
        return res.status(404).end();
      }
      return next();
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

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(() => {
      try {
        closeSqliteDb();
      } catch (error) {
        console.error('Error al cerrar SQLite:', error);
        process.exitCode = 1;
      }
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
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
