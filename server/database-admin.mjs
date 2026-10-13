import {randomUUID} from 'node:crypto';
import {createPostgresRepository,testPostgresConnection,validatePostgresUrl} from './postgres-repository.mjs';
import {writeDatabaseConfig} from './database-config.mjs';

function safeError(error){
  const message=String(error?.message??'');
  if(message==='Finish active duels before database migration.'||message==='Target PostgreSQL database is not empty.'||message.startsWith('Migration count mismatch:'))return message;
  return `PostgreSQL connection or migration failed (${error?.code??'unknown'}).`;
}

export function createDatabaseAdmin({repository,configSecret='',publicMode=false,freeze,testConnection=testPostgresConnection,targetRepository=createPostgresRepository,saveConfiguration=writeDatabaseConfig}){
  let job=null;
  return {
    status(){return {driver:repository.driver,canActivate:configSecret.length>=32,job};},
    async test(url){return testConnection(url,{publicMode});},
    start(url){
      if(repository.driver!=='sqlite')throw Error('Migration is only available while SQLite is active.');
      if(configSecret.length<32)throw Error('Set DB_CONFIG_KEY before migrating.');
      if(job?.state==='running'||job?.state==='completed')throw Error('A migration already exists.');
      validatePostgresUrl(url,{publicMode});
      const hold=freeze();
      job={id:randomUUID(),state:'running',stage:'waiting',startedAt:Date.now(),counts:null,error:null,restartRequired:false};
      void (async()=>{
        let target,imported=false;
        try{
          await hold.waitForDrain();
          job.stage='snapshot';const snapshot=await repository.exportSnapshot();
          job.stage='import';target=await targetRepository({connectionString:url,publicMode});
          const counts=await target.importSnapshot(snapshot);imported=true;
          job.stage='activation';await saveConfiguration(url,configSecret);
          job={...job,state:'completed',stage:'complete',completedAt:Date.now(),counts,restartRequired:true};
          // Keep SQLite read-only until the API restarts on PostgreSQL.
        }catch(error){
          job={...job,state:'failed',stage:'failed',completedAt:Date.now(),error:imported?'Data imported but activation failed. SQLite remains paused; repair configuration or restart the API to resume SQLite. Keep both databases for recovery.':safeError(error),restartRequired:imported};
          // Once import committed, resuming writes could silently diverge the two databases.
          if(!imported)hold.unfreeze();
        }
        finally{await target?.close().catch(()=>{});}
      })();
      return {id:job.id};
    },
  };
}
