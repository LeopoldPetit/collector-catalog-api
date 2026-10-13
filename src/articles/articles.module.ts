import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessagingModule } from '../messaging/messaging.module';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { ModerationResultsController } from './moderation-results.controller';

@Module({
  imports: [AuthModule, MessagingModule],
  controllers: [ArticlesController, ModerationResultsController],
  providers: [ArticlesService],
})
export class ArticlesModule {}
