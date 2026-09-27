import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { loadConfig, validateRuntimeConfig } from './config/env.js';
import './models/index.js';

export function createVercelHandler({
  environment = process.env,
  load = loadConfig,
  validate = validateRuntimeConfig,
  connect = connectDatabase,
  create = createApp,
} = {}) {
  let appPromise = null;

  return async function vercelHandler(request, response) {
    if (!appPromise) {
      const initialization = Promise.resolve().then(async () => {
        const config = validate(load(environment));
        await connect(config.mongoUri);
        return create(config);
      });
      appPromise = initialization.catch((error) => {
        appPromise = null;
        throw error;
      });
    }
    const app = await appPromise;
    return app(request, response);
  };
}

export default createVercelHandler();
