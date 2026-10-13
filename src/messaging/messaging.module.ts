import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RABBITMQ_URLS } from './rabbitmq.config';

export const MODERATION_BUS = 'MODERATION_BUS';
export const MODERATION_QUEUE = 'moderation';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: MODERATION_BUS,
        transport: Transport.RMQ,
        options: {
          urls: RABBITMQ_URLS,
          queue: MODERATION_QUEUE,
          queueOptions: { durable: true },
          persistent: true,
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class MessagingModule {}
