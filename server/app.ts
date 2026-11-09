import express from 'express';
import apiRouter from './routes/index.js';
import { errorHandler, notFoundApiHandler } from './lib/errors.js';

/** Construye la aplicación Express de la API (sin Vite ni listen) para servidor y pruebas. */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use('/api', apiRouter);
  app.use('/api', notFoundApiHandler);
  app.use(errorHandler);
  return app;
}
