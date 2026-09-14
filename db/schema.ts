import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const analyses = sqliteTable('analyses', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  data: text('data').notNull(),
});
export const images = sqliteTable('images', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
});
