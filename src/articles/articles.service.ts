import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ArticleStatus } from '@prisma/client';
import { lastValueFrom } from 'rxjs';
import { MODERATION_BUS } from '../messaging/messaging.module';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import {
  ARTICLE_SUBMITTED,
  ArticleSubmittedEvent,
} from './events/article-submitted.event';

@Injectable()
export class ArticlesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MODERATION_BUS) private readonly moderationBus: ClientProxy,
  ) {}

  async create(dto: CreateArticleDto, sellerId: string) {
    const article = await this.prisma.article.create({
      data: { ...dto, sellerId, status: ArticleStatus.DRAFT },
    });

    const event: ArticleSubmittedEvent = {
      articleId: article.id,
      sellerId,
      title: dto.title,
      description: dto.description,
      price: dto.price,
      shippingCost: dto.shippingCost,
      category: dto.category,
    };
    await lastValueFrom(this.moderationBus.emit(ARTICLE_SUBMITTED, event));

    return article;
  }

  async findOne(id: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException(`Article ${id} introuvable`);
    }
    return article;
  }

  findPublished() {
    return this.prisma.article.findMany({
      where: { status: ArticleStatus.PUBLISHED },
      orderBy: { createdAt: 'desc' },
    });
  }
}
