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
import { of } from 'rxjs';
import { AppModule } from '../app.module';
import { ModerationResultsController } from './moderation-results.controller';
import { KEYCLOAK_OPTIONS, KeycloakOptions } from '../auth/keycloak.options';
import { MODERATION_BUS } from '../messaging/messaging.module';
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
  let bus: { emit: jest.Mock };
  let prisma: {
    article: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
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
        updateMany: jest.fn(),
      },
    };

    bus = { emit: jest.fn(() => of(true)) };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(KEYCLOAK_OPTIONS)
      .useValue(keycloak)
      .overrideProvider(MODERATION_BUS)
      .useValue(bus)
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

  beforeEach(() => {
    jest.clearAllMocks();
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
    expect(bus.emit).toHaveBeenCalledWith(
      'article.submitted',
      expect.objectContaining({ articleId: 'art-1', sellerId: 'seller-42' }),
    );
  });

  it('POST /articles rejette une annonce invalide sans persister ni publier', async () => {
    const token = await signToken(trustedKey, { roles: ['vendeur'] });

    await request(app.getHttpServer())
      .post('/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_ARTICLE, description: 'trop court' })
      .expect(400);

    expect(prisma.article.create).not.toHaveBeenCalled();
    expect(bus.emit).not.toHaveBeenCalled();
  });

  it('publication → contrôle → statut : un article validé passe PUBLISHED', async () => {
    let status = ArticleStatus.DRAFT;
    prisma.article.updateMany.mockImplementation(async ({ data }) => {
      status = data.status;
      return { count: 1 };
    });
    prisma.article.findUnique.mockImplementation(async () => ({
      id: 'art-1',
      status,
      rejectionReason: null,
    }));
    const token = await signToken(trustedKey, {
      sub: 'seller-42',
      roles: ['vendeur'],
    });

    await request(app.getHttpServer())
      .post('/articles')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ARTICLE)
      .expect(201);
    const [, submitted] = bus.emit.mock.calls[0];

    await app
      .get(ModerationResultsController)
      .handleValidated({ articleId: submitted.articleId, reasons: [] });

    const response = await request(app.getHttpServer())
      .get('/articles/art-1')
      .expect(200);
    expect(response.body.status).toBe(ArticleStatus.PUBLISHED);
  });

  it('un article rejeté passe REJECTED avec son motif, un résultat redélivré est sans effet', async () => {
    prisma.article.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const controller = app.get(ModerationResultsController);
    const result = { articleId: 'art-9', reasons: ['prix manquant'] };

    await controller.handleRejected(result);
    await expect(controller.handleRejected(result)).resolves.toBeUndefined();

    expect(prisma.article.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.article.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ id: 'art-9' }),
        data: {
          status: ArticleStatus.REJECTED,
          rejectionReason: 'prix manquant',
        },
      }),
    );
  });
});
