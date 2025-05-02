import { Request, Response, NextFunction } from 'express';
import { expressjwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import { getConfig } from '../config';

const config = getConfig();

export const validateAuth0Token = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${config.auth0.domain}/.well-known/jwks.json`
  }),
  audience: config.auth0.audience,
  issuer: `https://${config.auth0.domain}/`,
  algorithms: ['RS256']
});

export const checkAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await validateAuth0Token(req, res, next);
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Unauthorized' });
  }
}; 