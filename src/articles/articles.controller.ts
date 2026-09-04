import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  create(@Body() dto: CreateArticleDto) {
    // TODO(US1): remplacer par l'id du vendeur authentifié une fois le guard JWT en place
    const sellerId = 'seller-placeholder';
    return this.articlesService.create(dto, sellerId);
  }

  @Get()
  findAll() {
    // US5 (catalogue public) : seuls les articles publiés sont exposés par cet endpoint
    return this.articlesService.findPublished();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articlesService.findOne(id);
  }
}
