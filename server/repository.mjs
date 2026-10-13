// HTTP/auth/game code only depends on the async repository contract.
import { createSqliteRepository } from './sqlite-repository.mjs';
import {createPostgresRepository} from './postgres-repository.mjs';
import {readDatabaseConfig} from './database-config.mjs';
export async function createRepository(options={}) {
  const environmentDriver=process.env.DB_DRIVER||undefined;
  const saved=options.driver===undefined&&environmentDriver===undefined?await readDatabaseConfig(options.configSecret??process.env.DB_CONFIG_KEY):null;
  const driver=options.driver??environmentDriver??saved?.driver??'sqlite';
  if(driver==='sqlite')return createSqliteRepository(options.filename??process.env.SQLITE_PATH??'data/code-climb.sqlite');
  if(driver==='postgres'){
    const connectionString=options.connectionString??(process.env.DATABASE_URL||saved?.url);
    if(!connectionString)throw Error('PostgreSQL requires DATABASE_URL or saved admin configuration.');
    return createPostgresRepository({connectionString,publicMode:options.publicMode??process.env.CODE_CLIMB_PUBLIC==='1'});
  }
  throw Error(`Unsupported DB_DRIVER: ${driver}.`);
}
