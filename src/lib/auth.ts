// src/lib/auth.ts
// Helper utilities for extracting the logged‑in user and role.
// Adjust the implementation according to your authentication strategy (JWT cookie, session, etc.).

export async function getUserFromRequest(req: Request) {
  // Example assumes a JWT stored in a cookie named "auth".
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(/auth=([^;]+)/);
  if (!match) {
    throw new Error('Authentication token not found');
  }
  const token = match[1];
  // Basic JWT decode (no verification) to extract payload.
  const payloadBase64 = token.split('.')[1];
  const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
  const payload = JSON.parse(payloadJson);
  return { role: payload.role as string, userId: payload.sub };
}

export async function getUserFromClient() {
  // Calls a lightweight endpoint that returns the current user data.
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) {
    throw new Error('Failed to fetch user info');
  }
  return await res.json(); // expected shape { role: string, userId: string }
}
