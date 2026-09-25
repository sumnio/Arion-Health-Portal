import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/healthRoutes.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

function corsOptions(origin, nodeEnv) {
  return {
    origin(requestOrigin, callback) {
      if (!requestOrigin || requestOrigin === origin) return callback(null, true);
      return callback(Object.assign(new Error('Origin is not allowed by CORS.'), { status: 403, code: 'CORS_DENIED' }));
    },
    credentials: nodeEnv !== 'production',
  };
}

export function createApp({ corsOrigin = 'http://127.0.0.1:5173', nodeEnv = 'development' } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors(corsOptions(corsOrigin, nodeEnv)));
  app.use(express.json());
  app.use('/api/health', healthRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
