import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getConfig } from './config.js';
import type { User } from './db.js';
import { usersRepository } from './repositories/users.js';
import type { Business } from './services/businesses.js';
import type { BusinessMember } from './repositories/members.js';

const JWT_EXPIRES_IN = '30d';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  business?: Business;
  membership?: BusinessMember;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function generateToken(user: Pick<User, 'id' | 'email'>): string {
  return jwt.sign({ userId: user.id, email: user.email }, getConfig().jwtSecret, { expiresIn: JWT_EXPIRES_IN });
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado. Token no proporcionado.' });
  }

  const token = authHeader.split(' ')[1];
  let decoded: { userId: string; email: string };
  try {
    decoded = jwt.verify(token, getConfig().jwtSecret) as { userId: string; email: string };
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado. Por favor inicia sesión nuevamente.' });
  }

  const user = usersRepository.findById(decoded.userId);
  if (!user) {
    return res.status(401).json({ error: 'Usuario no encontrado o sesión caducada.' });
  }

  req.userId = user.id;
  req.userEmail = user.email;
  next();
}
