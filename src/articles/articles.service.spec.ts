import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ArticleStatus } from '@prisma/client';
import { ArticlesService } from './articles.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ArticlesService', () => {
  let service: ArticlesService;
  let prisma: {
    article: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      article: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: PrismaService, useValue: prisma },
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
});
