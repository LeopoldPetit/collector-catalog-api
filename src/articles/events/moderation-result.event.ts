export const MODERATION_RESULTS_QUEUE = 'moderation-results';
export const ARTICLE_VALIDATED = 'article.validated';
export const ARTICLE_REJECTED = 'article.rejected';

export interface ArticleModerationResult {
  articleId: string;
  reasons: string[];
}
