import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb, saveDb, refreshDb, generateId, User, Profile, Subscription } from './db.js';
import { getSqliteDb } from './sqlite.js';
import { seedDemoDataIfEmpty as seedSqliteDemoData } from './seedData.js';

const JWT_SECRET = process.env.JWT_SECRET || 'salontrack_dev_secret_chile_2026';
const JWT_EXPIRES_IN = '30d';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRoles?: string[];
  businessId?: string;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function getUserRoles(userId: string): string[] {
  try {
    const db = getSqliteDb();
    const rows = db.prepare('SELECT role FROM user_roles WHERE user_id = ?').all(userId) as Array<{ role: string }>;
    return rows.map(r => r.role);
  } catch (err) {
    return ['CUSTOMER'];
  }
}

export function generateToken(user: User, roles: string[] = ['CUSTOMER']): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      roles,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado. Token no proporcionado.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; roles?: string[] };
    const sqlite = getSqliteDb();
    const userRow = sqlite.prepare('SELECT id, email, is_active FROM users WHERE id = ?').get(decoded.userId) as any;

    if (!userRow || !userRow.is_active) {
      return res.status(401).json({ error: 'Usuario no encontrado o cuenta desactivada.' });
    }

    req.userId = userRow.id;
    req.userEmail = userRow.email;
    req.userRoles = decoded.roles || getUserRoles(userRow.id);

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado. Por favor inicia sesión nuevamente.' });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'No autenticado.' });
    }
    const roles = req.userRoles || getUserRoles(req.userId);
    const hasRole = allowedRoles.some(r => roles.includes(r));
    if (!hasRole) {
      return res.status(403).json({ error: 'Acceso denegado. Permisos insuficientes para esta operación.' });
    }
    next();
  };
}

export function seedDemoDataIfEmpty() {
  seedSqliteDemoData();
  refreshDb();
}
