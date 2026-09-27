import { createServer } from 'node:http';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { getE2eRuntimeConfig } from './e2eEnvironment.js';
import '../src/models/index.js';

async function start() {
  const config = getE2eRuntimeConfig();
  await connectDatabase(config.mongoUri);

  const server = createServer(createApp(config));
  server.listen(config.port, '127.0.0.1', () => {
    console.info(`Arion Health E2E API listening on port ${config.port}.`);
  });

  async function shutdown(signal) {
    console.info(`${signal} received. Stopping the E2E API.`);
    server.close(async error => {
      await disconnectDatabase();
      process.exit(error ? 1 : 0);
    });
  }

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch(error => {
  console.error(`E2E API startup failed: ${error.message}`);
  process.exitCode = 1;
});
