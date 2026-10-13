import { INestApplication, ValidationPipe } from '@nestjs/common';

export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  });
}
