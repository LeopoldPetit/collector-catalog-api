import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

export const MODERATION_BUS = 'MODERATION_BUS';
export const MODERATION_QUEUE = 'moderation';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: MODERATION_BUS,
        transport: Transport.RMQ,
        options: {
          urls: [
            process.env.RABBITMQ_URL ??
              'amqp://collector:collector_dev_password@localhost:5672',
          ],
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
