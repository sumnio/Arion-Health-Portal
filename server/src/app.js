import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { healthRouter } from './routes/healthRoutes.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createAuthModule } from './services/authModule.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

function corsOptions(origin) {
  return {
    origin(requestOrigin, callback) {
      if (!requestOrigin || requestOrigin === origin) return callback(null, true);
      return callback(Object.assign(new Error('Origin is not allowed by CORS.'), { status: 403, code: 'CORS_DENIED' }));
    },
    credentials: true,
  };
}

export function createApp(
  {
    corsOrigin = 'http://127.0.0.1:5173',
    nodeEnv = 'development',
    authSecret = '',
  } = {},
  dependencies = {},
) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors(corsOptions(corsOrigin)));
  app.use(express.json());
  app.use(cookieParser());
  const authModule = dependencies.authModule ?? createAuthModule({ authSecret });
  app.use('/api/health', healthRouter);
  app.use('/api/auth', createAuthRouter({ ...authModule, nodeEnv }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
