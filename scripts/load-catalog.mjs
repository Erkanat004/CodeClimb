import {readFileSync} from 'node:fs';
import ts from 'typescript';
function moduleURL(file,replacements={}){
  let source=readFileSync(new URL('../lib/'+file,import.meta.url),'utf8');
  for(const [name,url] of Object.entries(replacements))source=source.replaceAll("'"+name+"'",JSON.stringify(url));
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  return 'data:text/javascript;base64,'+Buffer.from(js).toString('base64');
}
const base=moduleURL('challenges.ts');
const cpp=moduleURL('cpp-challenges.ts',{'./challenges':base});
export const catalog=await import(moduleURL('catalog.ts',{'./challenges':base,'./cpp-challenges':cpp}));
