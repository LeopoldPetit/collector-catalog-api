export const RABBITMQ_URLS = [
  process.env.RABBITMQ_URL ??
    'amqp://collector:collector_dev_password@localhost:5672',
];
