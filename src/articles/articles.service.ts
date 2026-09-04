import { Injectable, NotFoundException } from '@nestjs/common';
import { ArticleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateArticleDto, sellerId: string) {
    return this.prisma.article.create({
      data: { ...dto, sellerId, status: ArticleStatus.DRAFT },
    });
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
