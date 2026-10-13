import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ArticleStatus } from '@prisma/client';
import { of, throwError } from 'rxjs';
import { ArticlesService } from './articles.service';
import { PrismaService } from '../prisma/prisma.service';
import { MODERATION_BUS } from '../messaging/messaging.module';

describe('ArticlesService', () => {
  let service: ArticlesService;
  let bus: { emit: jest.Mock };
  let prisma: {
    article: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      article: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    bus = { emit: jest.fn(() => of(true)) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: PrismaService, useValue: prisma },
        { provide: MODERATION_BUS, useValue: bus },
      ],
    }).compile();

    service = moduleRef.get(ArticlesService);
  });

  it('crée un article avec le statut DRAFT', async () => {
    const dto = {
      title: 'Timbre rare 1920',
      description:
        'Un timbre en excellent état, provenance certifiée, description suffisamment longue.',
      price: 42,
      shippingCost: 5,
      category: 'timbres',
    };
    prisma.article.create.mockResolvedValue({
      id: '1',
      ...dto,
      status: ArticleStatus.DRAFT,
    });

    const result = await service.create(dto, 'seller-1');

    expect(prisma.article.create).toHaveBeenCalledWith({
      data: { ...dto, sellerId: 'seller-1', status: ArticleStatus.DRAFT },
    });
    expect(result.status).toBe(ArticleStatus.DRAFT);
    expect(bus.emit).toHaveBeenCalledWith('article.submitted', {
      articleId: '1',
      sellerId: 'seller-1',
      ...dto,
    });
  });

  it("ne publie pas d'événement si la persistance échoue", async () => {
    prisma.article.create.mockRejectedValue(new Error('db down'));

    await expect(
      service.create(
        {
          title: 'Timbre rare 1920',
          description:
            'Un timbre en excellent état, provenance certifiée, description suffisamment longue.',
          price: 42,
          shippingCost: 5,
          category: 'timbres',
        },
        'seller-1',
      ),
    ).rejects.toThrow('db down');
    expect(bus.emit).not.toHaveBeenCalled();
  });

  it("propage l'erreur si le bus RabbitMQ est indisponible", async () => {
    prisma.article.create.mockResolvedValue({ id: '2' });
    bus.emit.mockReturnValue(throwError(() => new Error('broker down')));

    await expect(
      service.create(
        {
          title: 'Timbre rare 1920',
          description:
            'Un timbre en excellent état, provenance certifiée, description suffisamment longue.',
          price: 42,
          shippingCost: 5,
          category: 'timbres',
        },
        'seller-1',
      ),
    ).rejects.toThrow('broker down');
  });

  it("lève une NotFoundException si l'article est introuvable", async () => {
    prisma.article.findUnique.mockResolvedValue(null);

    await expect(service.findOne('unknown')).rejects.toThrow(NotFoundException);
  });

  it('ne retourne que les articles publiés', async () => {
    prisma.article.findMany.mockResolvedValue([]);

    await service.findPublished();

    expect(prisma.article.findMany).toHaveBeenCalledWith({
      where: { status: ArticleStatus.PUBLISHED },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('publie un article validé avec le statut PUBLISHED', async () => {
    prisma.article.updateMany.mockResolvedValue({ count: 1 });

    const count = await service.applyModerationResult(
      'art-1',
      ArticleStatus.PUBLISHED,
      [],
    );

    expect(count).toBe(1);
    expect(prisma.article.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'art-1',
        status: { in: [ArticleStatus.DRAFT, ArticleStatus.PENDING] },
      },
      data: { status: ArticleStatus.PUBLISHED, rejectionReason: null },
    });
  });

  it('enregistre les motifs de rejet', async () => {
    prisma.article.updateMany.mockResolvedValue({ count: 1 });

    await service.applyModerationResult('art-2', ArticleStatus.REJECTED, [
      'prix manquant',
      'catégorie inconnue',
    ]);

    expect(prisma.article.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: ArticleStatus.REJECTED,
          rejectionReason: 'prix manquant, catégorie inconnue',
        },
      }),
    );
  });

  it('ignore un résultat déjà traité', async () => {
    prisma.article.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.applyModerationResult('art-3', ArticleStatus.PUBLISHED, []),
    ).resolves.toBe(0);
  });
});
