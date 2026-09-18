import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

/**
 * Cloudflare D1 enforces foreign keys for every query and migration, equivalent
 * to SQLite with `PRAGMA foreign_keys = ON`. The user-to-run and run-to-payload
 * deletion cascades rely on that D1 platform guarantee, not on Drizzle setting a
 * connection-local pragma. If this database is moved off D1, the replacement
 * adapter must enable foreign keys or provide explicit owner-data deletion.
 *
 * @see https://developers.cloudflare.com/d1/sql-api/foreign-keys/
 */
export function getDb() {
  return drizzle(env.prod_pulseweb_db, { schema });
}
