import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ArticleStatus } from '@prisma/client';
import { ArticlesService } from './articles.service';
import {
  ARTICLE_REJECTED,
  ARTICLE_VALIDATED,
  ArticleModerationResult,
} from './events/moderation-result.event';

@Controller()
export class ModerationResultsController {
  private readonly logger = new Logger(ModerationResultsController.name);

  constructor(private readonly articles: ArticlesService) {}

  @EventPattern(ARTICLE_VALIDATED)
  async handleValidated(
    @Payload() result: ArticleModerationResult,
  ): Promise<void> {
    await this.apply(result, ArticleStatus.PUBLISHED, []);
  }

  @EventPattern(ARTICLE_REJECTED)
  async handleRejected(
    @Payload() result: ArticleModerationResult,
  ): Promise<void> {
    await this.apply(result, ArticleStatus.REJECTED, result.reasons);
  }

  private async apply(
    result: ArticleModerationResult,
    status: Extract<ArticleStatus, 'PUBLISHED' | 'REJECTED'>,
    reasons: string[],
  ): Promise<void> {
    const updated = await this.articles.applyModerationResult(
      result.articleId,
      status,
      reasons,
    );
    if (updated === 0) {
      this.logger.warn(
        `Résultat ignoré pour ${result.articleId} : article absent ou déjà traité`,
      );
      return;
    }
    this.logger.log(`Article ${result.articleId} -> ${status}`);
  }
}
