export const ARTICLE_SUBMITTED = 'article.submitted';

export interface ArticleSubmittedEvent {
  articleId: string;
  sellerId: string;
  title: string;
  description: string;
  price: number;
  shippingCost: number;
  category: string;
}
