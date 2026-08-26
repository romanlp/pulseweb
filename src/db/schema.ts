import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export * from "./auth-schema";

export const healthChecks = sqliteTable("health_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  note: text("note").notNull(),
});
