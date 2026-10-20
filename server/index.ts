import 'dotenv/config';
import app from './app.js';
import { requireDatabaseUrl } from './db.js';

const port = Number(process.env.API_PORT || 3001);

try {
  requireDatabaseUrl();
  app.listen(port, '0.0.0.0', () => {
    console.log(`HomeMeal API listening on http://localhost:${port}`);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
