/**
 * JWT helpers using `jose` (edge-compatible, no Node.js crypto required).
 * Replaces `jsonwebtoken`.
 */

import { SignJWT, jwtVerify } from 'jose';

/** Sign a JWT payload */
export async function signToken(payload, secret, expiresIn = '7d') {
  const key = new TextEncoder().encode(secret);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

/** Verify a JWT and return the payload */
export async function verifyToken(token, secret) {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key);
  return payload;
}
