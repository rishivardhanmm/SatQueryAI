export async function bindings() {
  const { env } = await import('cloudflare:workers');
  return env as unknown as { DB: D1Database; IMAGES: R2Bucket };
}
export async function saveRecord(
  table: 'analyses' | 'images',
  id: string,
  data: unknown,
) {
  const { DB } = await bindings();
  if (table === 'analyses')
    await DB.prepare(
      'INSERT INTO analyses (id,created_at,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
    )
      .bind(id, new Date().toISOString(), JSON.stringify(data))
      .run();
  else
    await DB.prepare(
      'INSERT INTO images (id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
    )
      .bind(id, JSON.stringify(data))
      .run();
}
export async function getRecord(table: 'analyses' | 'images', id: string) {
  const { DB } = await bindings();
  const row = await DB.prepare(`SELECT data FROM ${table} WHERE id=?`)
    .bind(id)
    .first<{ data: string }>();
  return row ? JSON.parse(row.data) : null;
}
