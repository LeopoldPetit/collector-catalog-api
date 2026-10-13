import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { KEYCLOAK_OPTIONS, keycloakOptionsFromEnv } from './keycloak.options';
import { RolesGuard } from './roles.guard';

@Module({
  providers: [
    { provide: KEYCLOAK_OPTIONS, useFactory: keycloakOptionsFromEnv },
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [KEYCLOAK_OPTIONS, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
