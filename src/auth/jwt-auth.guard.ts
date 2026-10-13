import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { jwtVerify } from 'jose';
import { AuthenticatedRequest } from './authenticated-user';
import { KEYCLOAK_OPTIONS, KeycloakOptions } from './keycloak.options';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(KEYCLOAK_OPTIONS) private readonly keycloak: KeycloakOptions,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Jeton Bearer manquant');
    }

    let payload;
    try {
      ({ payload } = await jwtVerify(token, this.keycloak.keys, {
        issuer: this.keycloak.issuer,
        algorithms: ['RS256'],
      }));
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }

    const realmAccess = payload.realm_access as
      { roles?: string[] } | undefined;
    if (!payload.sub) {
      throw new UnauthorizedException('Jeton sans sujet');
    }
    request.user = { sub: payload.sub, roles: realmAccess?.roles ?? [] };
    return true;
  }
}

function extractBearerToken(header: string | undefined): string | undefined {
  const [scheme, token] = (header ?? '').split(' ');
  return scheme === 'Bearer' && token ? token : undefined;
}
