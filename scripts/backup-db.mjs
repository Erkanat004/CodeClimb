import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {loadLocalEnvironment} from '../server/env.mjs';
loadLocalEnvironment();
const source=path.resolve(process.env.SQLITE_PATH??'data/code-climb.sqlite');
if(!existsSync(source))throw Error('SQLite database does not exist. Start npm run local first.');
const dir=path.join(path.dirname(source),'backups');mkdirSync(dir,{recursive:true});
const destination=path.join(dir,`code-climb-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);
const db=new DatabaseSync(source,{readOnly:true});
try{await backup(db,destination);console.log('Backup saved:',destination);}finally{db.close();}
