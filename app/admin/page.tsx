'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {AccountProvider,AccountButton,accountRequest,useAccount} from '@/components/account';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {Mountain,RefreshCw,ShieldCheck,Users,Mail,LockKeyhole} from 'lucide-react';
import {difficultyLabels,type Difficulty} from '@/lib/catalog';
import {AdminAds} from '@/components/admin-ads';

type Player={id:string;username:string;email:string|null;email_verified_at:number|null;role:string;disabled:number;created_at:number};
type Progress={language:string;difficulty:Difficulty;completed:number;updated_at:number};
type Overview={users:number;verified:number;blocked:number;sessions:number;mailMode:string;publicMode:boolean};
type Action={user:Player;kind:'block'|'unblock'|'revoke-sessions'};
const actionNames={block:'Заблокировать',unblock:'Разблокировать','revoke-sessions':'Завершить сессии'};
export default function AdminPage(){return <AccountProvider><AdminContent/></AccountProvider>;}
function AdminContent(){
  const {user,ready}=useAccount();
  const [overview,setOverview]=useState<Overview|null>(null),[players,setPlayers]=useState<Player[]>([]),[total,setTotal]=useState(0);
  const [query,setQuery]=useState(''),[search,setSearch]=useState(''),[offset,setOffset]=useState(0),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [selected,setSelected]=useState<Player|null>(null),[progress,setProgress]=useState<Progress[]|null>(null),[action,setAction]=useState<Action|null>(null),[saving,setSaving]=useState(false);
  const generation=useRef(0),detailGeneration=useRef(0),acting=useRef(false);
  async function load(){
    const version=++generation.current;setLoading(true);setError('');
    try{const [stats,list]=await Promise.all([accountRequest('admin/overview'),accountRequest('admin/users?q='+encodeURIComponent(search)+'&offset='+offset)]);if(version!==generation.current)return;setOverview(stats as unknown as Overview);setPlayers(list.users as Player[]);setTotal(Number(list.total));}
    catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Не удалось загрузить игроков.');}
    finally{if(version===generation.current)setLoading(false);}
  }
  useEffect(()=>{let active=true;if(user?.role==='admin')void Promise.resolve().then(()=>{if(active)void load();});return()=>{active=false;generation.current++;detailGeneration.current++;};},[user?.id,user?.role,search,offset]);
  async function showProgress(p:Player){
    const version=++detailGeneration.current;setSelected(p);setProgress(null);setError('');
    try{const data=await accountRequest('admin/users/'+p.id);if(version===detailGeneration.current)setProgress(data.progress as Progress[]);}
    catch(e){if(version===detailGeneration.current){setSelected(null);setError(e instanceof Error?e.message:'Не удалось загрузить прогресс.');}}
  }
  async function applyAction(){
    if(!action||acting.current)return;acting.current=true;setSaving(true);setError('');
    try{await accountRequest('admin/users/'+action.user.id+'/'+action.kind,'POST',{});setAction(null);await load();}
    catch(e){setError(e instanceof Error?e.message:'Действие не выполнено.');}
    finally{acting.current=false;setSaving(false);}
  }
  return <main className="admin-app">
    <header className="admin-header"><Link className="wordmark" href="/"><Mountain size={28}/>CODE CLIMB</Link><span><ShieldCheck size={18}/> Управление игрой</span><AccountButton disabled={false} beforeChange={async()=>true}/></header>
    <section className="admin-content">
      {!ready?<p>Проверяем доступ…</p>:user?.role!=='admin'?<div className="admin-gate"><LockKeyhole size={40}/><h1>Панель администратора</h1><p>{user?'У этого аккаунта нет прав администратора.':'Войди под администратором через кнопку «Войти».'}</p><Link href="/">Вернуться к игре</Link></div>:<>
        <div className="admin-heading"><div><p className="admin-eyebrow">КОНТРОЛЬ ВОСХОЖДЕНИЯ</p><h1>Игроки и прогресс</h1><p>Python и C++ · 15 уровней полного маршрута</p></div><button className="run-button" disabled={loading} onClick={()=>void load()}><RefreshCw size={16}/>Обновить</button></div>
        {error&&<p className="auth-error" role="alert">{error}</p>}
        <div className="admin-stats">
          {[{label:'Игроков',value:overview?.users,icon:<Users/>},{label:'Почта подтверждена',value:overview?.verified,icon:<Mail/>},{label:'Заблокировано',value:overview?.blocked,icon:<LockKeyhole/>},{label:'Аккаунты с активной сессией',value:overview?.sessions,icon:<ShieldCheck/>}].map(s=><div key={s.label}>{s.icon}<strong>{s.value??'—'}</strong><span>{s.label}</span></div>)}
        </div>
        <div className="admin-service-note"><span>{overview?.publicMode?'Публичный режим · HTTPS':'Локальный режим'}</span><span>{overview?.mailMode==='resend'?'Отправка почты подключена':overview?.mailMode==='file'?'Почта: локальные тестовые письма':'Отправка почты не подключена'}</span></div>
        <form className="admin-search" onSubmit={e=>{e.preventDefault();setOffset(0);setSearch(query.trim());}}><label htmlFor="player-search">Найти игрока</label><input id="player-search" value={query} maxLength={100} onChange={e=>setQuery(e.target.value)} placeholder="Логин или email"/><button className="submit-button" type="submit" disabled={loading}>Найти</button></form>
        <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Игрок</th><th>Почта</th><th>Статус</th><th>Регистрация</th><th>Управление</th></tr></thead><tbody>
          {players.map(p=><tr key={p.id}><td><strong>{p.username}</strong><small>{p.role==='admin'?'Администратор':'Игрок'}</small></td><td>{p.email??'Не указана'}<small>{p.email_verified_at?'Подтверждена':p.role==='admin'?'Серверный аккаунт':'Прежний аккаунт'}</small></td><td><span className={p.disabled?'admin-status blocked':'admin-status'}>{p.disabled?'Заблокирован':'Доступ открыт'}</span></td><td>{new Date(p.created_at).toLocaleDateString('ru-RU')}</td><td><div className="admin-row-actions"><button onClick={()=>void showProgress(p)}>Прогресс</button>{p.role!=='admin'&&<><button onClick={()=>setAction({user:p,kind:p.disabled?'unblock':'block'})}>{p.disabled?'Разблокировать':'Блокировать'}</button><button onClick={()=>setAction({user:p,kind:'revoke-sessions'})}>Завершить сессии</button></>}</div></td></tr>)}
          {!players.length&&!loading&&<tr><td colSpan={5}>Игроки не найдены.</td></tr>}
        </tbody></table></div>
        <div className="admin-pagination"><button disabled={offset===0||loading} onClick={()=>setOffset(n=>Math.max(0,n-50))}>Назад</button><span>{total?offset+1:0}–{Math.min(offset+50,total)} из {total}{loading?' · Загрузка…':''}</span><button disabled={offset+50>=total||loading} onClick={()=>setOffset(n=>n+50)}>Далее</button></div>
        <p className="admin-disclaimer">Это сохранённый тренировочный прогресс, не защищённый рейтинг соревнования. Пароли, коды подтверждения и токены здесь не отображаются.</p>
        <AdminAds/>
      </>}
    </section>
    <Dialog open={Boolean(selected)} onOpenChange={v=>{if(!v){detailGeneration.current++;setSelected(null);}}}><DialogContent className="small-dialog"><DialogTitle>Прогресс · {selected?.username}</DialogTitle><DialogDescription>Каждый язык и маршрут сохраняются отдельно.</DialogDescription>{progress===null?<p>Загрузка…</p>:progress.length?<ul className="admin-progress">{progress.map(p=><li key={p.language+p.difficulty}><span>{p.language==='cpp'?'C++':'Python'} · {difficultyLabels[p.difficulty]}</span><strong>{p.completed}/{['full','classic'].includes(p.difficulty)?15:5}</strong></li>)}</ul>:<p>Игрок пока не сохранил прохождение.</p>}</DialogContent></Dialog>
    <Dialog open={Boolean(action)} onOpenChange={v=>{if(!v&&!saving)setAction(null);}}><DialogContent className="small-dialog"><DialogTitle>{action&&actionNames[action.kind]}?</DialogTitle><DialogDescription>{action?.user.username}. {action?.kind==='unblock'?'Игрок снова сможет войти.':'Все текущие сессии игрока будут завершены. Прогресс останется сохранён.'}</DialogDescription><div className="dialog-actions"><button className="run-button" disabled={saving} onClick={()=>setAction(null)}>Отмена</button><button className="submit-button" disabled={saving} onClick={()=>void applyAction()}>{saving?'Выполняем…':'Подтвердить'}</button></div>{error&&<p role="alert" className="auth-error">{error}</p>}</DialogContent></Dialog>
  </main>;
}
