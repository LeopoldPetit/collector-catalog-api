import type { Request } from 'express';

export interface AuthenticatedUser {
  sub: string;
  roles: string[];
}

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };
