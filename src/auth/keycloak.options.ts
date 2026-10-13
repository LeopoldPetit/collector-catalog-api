import { createRemoteJWKSet, JWTVerifyGetKey } from 'jose';

export const KEYCLOAK_OPTIONS = Symbol('KEYCLOAK_OPTIONS');

export interface KeycloakOptions {
  issuer: string;
  keys: JWTVerifyGetKey;
}

export const DEFAULT_KEYCLOAK_ISSUER =
  'http://localhost:8080/realms/collector-shop';

export function keycloakOptionsFromEnv(): KeycloakOptions {
  const issuer = process.env.KEYCLOAK_ISSUER || DEFAULT_KEYCLOAK_ISSUER;
  const jwksUrl =
    process.env.KEYCLOAK_JWKS_URL || `${issuer}/protocol/openid-connect/certs`;
  return { issuer, keys: createRemoteJWKSet(new URL(jwksUrl)) };
}
