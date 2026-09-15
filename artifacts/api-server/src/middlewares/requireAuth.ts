import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

export type AuthenticatedRequest = Request & { userId: string };

export function getAuthenticatedUserId(req: Request): string | null {
  const auth = getAuth(req);
  const claims = auth as {
    userId?: string | null;
    sessionClaims?: { userId?: string | null } | null;
  };
  return claims.userId ?? claims.sessionClaims?.userId ?? null;
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthenticatedRequest).userId = userId;
  next();
}