// The application depends on these async repository methods, never on SQLite.
// Add a PostgreSQL implementation here without changing HTTP/auth/game code.
import { createSqliteRepository } from './sqlite-repository.mjs';
export async function createRepository(options={}) {
  const driver=options.driver??process.env.DB_DRIVER??'sqlite';
  if(driver!=='sqlite')throw Error(`Unsupported DB_DRIVER: ${driver}. Implement the repository contract before switching databases.`);
  return createSqliteRepository(options.filename??process.env.SQLITE_PATH??'data/code-climb.sqlite');
}
