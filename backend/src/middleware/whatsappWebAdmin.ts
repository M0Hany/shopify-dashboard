import { Request, Response, NextFunction } from 'express';

/** Optional shared secret for WhatsApp Web pairing endpoints. */
export function requireWhatsAppWebAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const secret = process.env.WHATSAPP_WEB_ADMIN_SECRET;
  if (!secret) {
    next();
    return;
  }

  const header = req.header('x-whatsapp-web-secret');
  if (header !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
