import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ArticleStatus } from '@prisma/client';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  KeyLike,
  SignJWT,
} from 'jose';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { KEYCLOAK_OPTIONS, KeycloakOptions } from '../auth/keycloak.options';
import { PrismaService } from '../prisma/prisma.service';

const ISSUER = 'http://keycloak.test/realms/collector-shop';
const KID = 'test-key';
const VALID_ARTICLE = {
  title: 'Timbre rare 1920',
  description:
    'Un timbre en excellent état, provenance certifiée, description suffisamment longue.',
  price: 42,
  shippingCost: 5,
  category: 'timbres',
};

interface TokenOptions {
  sub?: string;
  roles?: string[];
  issuer?: string;
  expiration?: string | number;
}

describe('Articles API - intégration sécurité (JWT Keycloak)', () => {
  let app: INestApplication;
  let trustedKey: KeyLike;
  let untrustedKey: KeyLike;
  let prisma: {
    article: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
  };

  async function signToken(
    key: KeyLike,
    options: TokenOptions = {},
  ): Promise<string> {
    const {
      sub = 'seller-42',
      roles = ['vendeur'],
      issuer = ISSUER,
      expiration = '5m',
    } = options;
    return new SignJWT({ realm_access: { roles } })
      .setProtectedHeader({ alg: 'RS256', kid: KID })
      .setSubject(sub)
      .setIssuer(issuer)
      .setIssuedAt()
      .setExpirationTime(expiration)
      .sign(key);
  }

  beforeAll(async () => {
    const trusted = await generateKeyPair('RS256');
    const untrusted = await generateKeyPair('RS256');
    trustedKey = trusted.privateKey;
    untrustedKey = untrusted.privateKey;

    const jwk = {
      ...(await exportJWK(trusted.publicKey)),
      kid: KID,
      alg: 'RS256',
      use: 'sig',
    };
    const keycloak: KeycloakOptions = {
      issuer: ISSUER,
      keys: createLocalJWKSet({ keys: [jwk] }),
    };

    prisma = {
      article: {
        create: jest.fn(async ({ data }) => ({ id: 'art-1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(KEYCLOAK_OPTIONS)
      .useValue(keycloak)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /articles reste public et ne retourne que les articles publiés', async () => {
    await request(app.getHttpServer()).get('/articles').expect(200);

    expect(prisma.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: ArticleStatus.PUBLISHED },
      }),
    );
  });

  it('POST /articles refuse une requête sans jeton', async () => {
    await request(app.getHttpServer())
      .post('/articles')
      .send(VALID_ARTICLE)
      .expect(401);
  });

  it('POST /articles refuse un jeton mal formé', async () => {
    await request(app.getHttpServer())
      .post('/articles')
      .set('Authorization', 'Bearer not-a-jwt')
      .send(VALID_ARTICLE)
      .expect(401);
  });

  it('POST /articles refuse un jeton signé par une clé non approuvée', async () => {
    const forged = await signToken(untrustedKey);

    await request(app.getHttpServer())
      .post('/articles')
      .set('Authorization', `Bearer ${forged}`)
      .send(VALID_ARTICLE)
      .expect(401);
  });

  it('POST /articles refuse un jeton émis par un autre issuer', async () => {
    const token = await signToken(trustedKey, {
      issuer: 'http://autre-idp.test/realms/x',
    });

    await request(app.getHttpServer())
      .post('/articles')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ARTICLE)
      .expect(401);
  });

  it('POST /articles refuse un jeton expiré', async () => {
    const token = await signToken(trustedKey, {
      expiration: Math.floor(Date.now() / 1000) - 60,
    });

    await request(app.getHttpServer())
      .post('/articles')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ARTICLE)
      .expect(401);
  });

  it('POST /articles refuse un acheteur sans rôle vendeur', async () => {
    const token = await signToken(trustedKey, { roles: ['acheteur'] });

    await request(app.getHttpServer())
      .post('/articles')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ARTICLE)
      .expect(403);
    expect(prisma.article.create).not.toHaveBeenCalled();
  });

  it('POST /articles crée un article en DRAFT pour un vendeur authentifié', async () => {
    const token = await signToken(trustedKey, {
      sub: 'seller-42',
      roles: ['vendeur'],
    });

    const response = await request(app.getHttpServer())
      .post('/articles')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ARTICLE)
      .expect(201);

    expect(prisma.article.create).toHaveBeenCalledWith({
      data: {
        ...VALID_ARTICLE,
        sellerId: 'seller-42',
        status: ArticleStatus.DRAFT,
      },
    });
    expect(response.body.sellerId).toBe('seller-42');
  });
});
