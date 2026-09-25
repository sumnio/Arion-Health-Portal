import { createServer } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import './models/index.js';

async function start() {
  const config = loadConfig();
  await connectDatabase(config.mongoUri);

  const server = createServer(createApp(config));
  server.listen(config.port, () => {
    console.info(`Arion Health API listening on port ${config.port}.`);
  });

  async function shutdown(signal) {
    console.info(`${signal} received. Shutting down.`);
    server.close(async error => {
      await disconnectDatabase();
      if (error) console.error('HTTP server shutdown failed:', error.message);
      process.exit(error ? 1 : 0);
    });
  }

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch(error => {
  console.error('API startup failed:', error.message);
  process.exitCode = 1;
});
