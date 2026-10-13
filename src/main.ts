import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { MODERATION_RESULTS_QUEUE } from './articles/events/moderation-result.event';
import { RABBITMQ_URLS } from './messaging/rabbitmq.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: RABBITMQ_URLS,
      queue: MODERATION_RESULTS_QUEUE,
      queueOptions: { durable: true },
    },
  });
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
