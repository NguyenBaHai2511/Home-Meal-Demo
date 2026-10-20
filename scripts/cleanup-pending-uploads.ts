import 'dotenv/config';
import { pool, requireDatabaseUrl } from '../server/db.js';
import { deleteEvidenceObject, isObjectStorageConfigured } from '../server/objectStorage.js';

try {
  requireDatabaseUrl();
  if (!isObjectStorageConfigured()) throw new Error('Object storage is not configured.');
  const pending = await pool.query(
    "SELECT id, object_key FROM order_files WHERE state = 'pending' AND created_at < NOW() - INTERVAL '2 hours' ORDER BY created_at LIMIT 200",
  );
  let removed = 0;
  for (const file of pending.rows) {
    try { await deleteEvidenceObject(file.object_key); }
    catch { continue; }
    await pool.query('DELETE FROM order_files WHERE id = $1 AND state = $2', [file.id, 'pending']);
    removed += 1;
  }
  console.log(JSON.stringify({ level: 'info', event: 'pending_upload_cleanup', removed }));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
