'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {AccountProvider,AccountButton,accountRequest,useAccount} from '@/components/account';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {Mountain,RefreshCw,ShieldCheck,Users,Mail,LockKeyhole,LayoutDashboard,Database,ExternalLink,Radio,ArrowUpRight,ChartNoAxesCombined} from 'lucide-react';
import {type Difficulty} from '@/lib/catalog';
import {difficultyLabel} from '@/lib/challenge-translations';
import {LanguageSwitcher,useLanguage} from '@/lib/i18n';
import {AdminAds} from '@/components/admin-ads';
import {AdminDatabase} from '@/components/admin-database';

type Player={id:string;username:string;email:string|null;email_verified_at:number|null;role:string;disabled:number;created_at:number};
type Progress={language:string;difficulty:Difficulty;completed:number;updated_at:number};
type Overview={users:number;verified:number;blocked:number;sessions:number;mailMode:string;publicMode:boolean;database:string};
type Action={user:Player;kind:'block'|'unblock'|'revoke-sessions'};
export default function AdminPage(){return <AccountProvider><AdminContent/></AccountProvider>;}
function AdminContent(){
  const {user,ready}=useAccount();
  const {language,t}=useLanguage();
  const [tab,setTab]=useState<'overview'|'players'|'storage'|'ads'>('overview');
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
  const title=tab==='overview'?t('Обзор','Overview'):tab==='players'?t('Игроки','Players'):tab==='storage'?t('База данных','Database'):t('Реклама','Ads');
  const actionTitle=(kind:Action['kind'])=>kind==='block'?t('Заблокировать','Block'):kind==='unblock'?t('Разблокировать','Unblock'):t('Завершить сессии','Revoke sessions');
  return <main className="admin-app">
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/"><span className="admin-brand-icon"><Mountain size={25}/></span><span>CODE<br/><b>CLIMB</b></span></Link>
        <div className="admin-sidebar-label">{t('ЦЕНТР УПРАВЛЕНИЯ','CONTROL CENTER')}</div>
        <nav className="admin-nav" aria-label={t('Разделы админки','Admin sections')}>
          {[
            {id:'overview',label:t('Обзор','Overview'),icon:<LayoutDashboard size={18}/>},
            {id:'players',label:t('Игроки','Players'),icon:<Users size={18}/>},
            {id:'storage',label:t('База данных','Database'),icon:<Database size={18}/>},
            {id:'ads',label:t('Реклама','Ads'),icon:<Radio size={18}/>},
          ].map(item=><button type="button" key={item.id} className={tab===item.id?'active':''} aria-current={tab===item.id?'page':undefined} onClick={()=>setTab(item.id as typeof tab)}>{item.icon}<span>{item.label}</span><ArrowUpRight size={14} className="admin-nav-arrow"/></button>)}
        </nav>
        <div className="admin-sidebar-foot"><span className="admin-sidebar-online"><i/>{overview?.publicMode?t('Публичный режим','Public mode'):t('Локальный режим','Local mode')}</span><Link href="/">{t('Вернуться к игре','Back to game')} <ExternalLink size={14}/></Link></div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar"><div className="admin-breadcrumb"><ShieldCheck size={18}/><span>{t('Администрирование','Administration')}</span><b>/</b><strong>{title}</strong></div><div className="admin-top-actions"><LanguageSwitcher/><AccountButton disabled={false} beforeChange={async()=>true}/></div></header>
        <section className="admin-content">
          {!ready?<div className="admin-loading">{t('Проверяем доступ…','Checking access…')}</div>:user?.role!=='admin'?<div className="admin-gate"><LockKeyhole size={40}/><h1>{t('Панель администратора','Admin dashboard')}</h1><p>{user?t('У этого аккаунта нет прав администратора.','This account does not have admin access.'):t('Войди под администратором через кнопку «Войти».','Sign in with an administrator account.')}</p><Link href="/">{t('Вернуться к игре','Back to game')}</Link></div>:<>
            {tab==='overview'&&<>
              <div className="admin-hero"><div><span className="admin-eyebrow">{t('МИССИЯ ПОД КОНТРОЛЕМ','MISSION CONTROL')}</span><h1>{t('Всё восхождение','The whole climb')}<br/><em>{t('на одном экране.','at a glance.')}</em></h1><p>{t('Игроки, безопасность и состояние игры — в одном месте.','Players, security, and game health in one place.')}</p><button className="admin-hero-action" onClick={()=>setTab('players')}>{t('Управлять игроками','Manage players')}<ArrowUpRight size={17}/></button></div><div className="admin-hero-visual"><Mountain size={120}/><span>8848</span><small>CODE CLIMB / ADMIN</small></div></div>
              {error&&<p className="auth-error" role="alert">{error}</p>}
              <div className="admin-section-heading"><div><span className="admin-eyebrow">{t('ЖИВЫЕ ПОКАЗАТЕЛИ','LIVE NUMBERS')}</span><h2>{t('Состояние площадки','Platform status')}</h2></div><button className="admin-refresh" disabled={loading} onClick={()=>void load()}><RefreshCw size={15}/>{t('Обновить','Refresh')}</button></div>
              <div className="admin-stats">
                {[{label:t('Игроков','Players'),value:overview?.users,icon:<Users/>},{label:t('Почта подтверждена','Verified emails'),value:overview?.verified,icon:<Mail/>},{label:t('Заблокировано','Blocked'),value:overview?.blocked,icon:<LockKeyhole/>},{label:t('Активных игроков','Active players'),value:overview?.sessions,icon:<ChartNoAxesCombined/>}].map(s=><div key={s.label}>{s.icon}<strong>{s.value??'—'}</strong><span>{s.label}</span></div>)}
              </div>
              <div className="admin-health-grid"><div><span className="admin-eyebrow">{t('ПОДКЛЮЧЕНИЯ','CONNECTIONS')}</span><h3>{t('Инфраструктура','Infrastructure')}</h3><div><Database size={17}/><span>{t('База данных','Database')}</span><strong>{overview?.database==='postgres'?'PostgreSQL':'SQLite'}</strong></div><div><Mail size={17}/><span>{t('Почта','Email')}</span><strong>{overview?.mailMode==='resend'?t('Подключена','Connected'):overview?.mailMode==='file'?t('Тестовый режим','Test mode'):t('Не подключена','Not connected')}</strong></div><div><ShieldCheck size={17}/><span>{t('Доступ','Access')}</span><strong>{overview?.publicMode?'HTTPS':t('Локальный','Local')}</strong></div></div><div className="admin-next-card"><span className="admin-eyebrow">{t('УПРАВЛЕНИЕ','OPERATIONS')}</span><h3>{t('Настрой игру под себя','Shape the experience')}</h3><p>{t('Проверь игроков, подготовь PostgreSQL или настрой добровольные подсказки за рекламу.','Review players, prepare PostgreSQL, or configure optional rewarded hints.')}</p><div><button onClick={()=>setTab('storage')}>{t('База данных','Database')} <ArrowUpRight size={15}/></button><button onClick={()=>setTab('ads')}>{t('Реклама','Ads')} <ArrowUpRight size={15}/></button></div></div></div>
            </>}
            {tab==='players'&&<>
              <div className="admin-page-heading"><div><span className="admin-eyebrow">{t('УЧАСТНИКИ ВОСХОЖДЕНИЯ','CLIMBERS')}</span><h1>{t('Игроки и прогресс','Players & progress')}</h1><p>{t('Управляй доступом, просматривай маршруты и отзывай сессии.','Manage access, inspect routes, and revoke sessions.')}</p></div><button className="admin-refresh" disabled={loading} onClick={()=>void load()}><RefreshCw size={15}/>{t('Обновить','Refresh')}</button></div>
              {error&&<p className="auth-error" role="alert">{error}</p>}
              <form className="admin-search" onSubmit={e=>{e.preventDefault();setOffset(0);setSearch(query.trim());}}><label htmlFor="player-search">{t('Найти игрока','Find a player')}</label><input id="player-search" value={query} maxLength={100} onChange={e=>setQuery(e.target.value)} placeholder={t('Логин или email','Username or email')}/><button className="submit-button" type="submit" disabled={loading}>{t('Найти','Search')}</button></form>
              <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>{t('Игрок','Player')}</th><th>{t('Почта','Email')}</th><th>{t('Статус','Status')}</th><th>{t('Регистрация','Joined')}</th><th>{t('Управление','Actions')}</th></tr></thead><tbody>
                {players.map(p=><tr key={p.id}><td><strong>{p.username}</strong><small>{p.role==='admin'?t('Администратор','Administrator'):t('Игрок','Player')}</small></td><td>{p.email??t('Не указана','Not provided')}<small>{p.email_verified_at?t('Подтверждена','Verified'):p.role==='admin'?t('Серверный аккаунт','Server account'):t('Прежний аккаунт','Legacy account')}</small></td><td><span className={p.disabled?'admin-status blocked':'admin-status'}>{p.disabled?t('Заблокирован','Blocked'):t('Доступ открыт','Active')}</span></td><td>{new Date(p.created_at).toLocaleDateString(language==='en'?'en-US':'ru-RU')}</td><td><div className="admin-row-actions"><button onClick={()=>void showProgress(p)}>{t('Прогресс','Progress')}</button>{p.role!=='admin'&&<><button onClick={()=>setAction({user:p,kind:p.disabled?'unblock':'block'})}>{p.disabled?t('Разблокировать','Unblock'):t('Блокировать','Block')}</button><button onClick={()=>setAction({user:p,kind:'revoke-sessions'})}>{t('Завершить сессии','Revoke sessions')}</button></>}</div></td></tr>)}
                {!players.length&&!loading&&<tr><td colSpan={5}>{t('Игроки не найдены.','No players found.')}</td></tr>}
              </tbody></table></div>
              <div className="admin-pagination"><button disabled={offset===0||loading} onClick={()=>setOffset(n=>Math.max(0,n-50))}>{t('Назад','Previous')}</button><span>{total?offset+1:0}–{Math.min(offset+50,total)} {t('из','of')} {total}{loading?t(' · Загрузка…',' · Loading…'):''}</span><button disabled={offset+50>=total||loading} onClick={()=>setOffset(n=>n+50)}>{t('Далее','Next')}</button></div>
              <p className="admin-disclaimer">{t('Это сохранённый тренировочный прогресс, не защищённый рейтинг соревнования. Пароли, коды подтверждения и токены здесь не отображаются.','This is saved training progress, not a protected competition ranking. Passwords, verification codes, and tokens are never shown here.')}</p>
            </>}
            {tab==='storage'&&<><div className="admin-page-heading"><div><span className="admin-eyebrow">{t('ДАННЫЕ И НАДЁЖНОСТЬ','DATA & RELIABILITY')}</span><h1>{t('Хранилище игры','Game storage')}</h1><p>{t('Подготовь переход без потери прогресса.','Prepare a switch without losing progress.')}</p></div></div><AdminDatabase/></>}
            {tab==='ads'&&<><div className="admin-page-heading"><div><span className="admin-eyebrow">{t('НАГРАДЫ И ПОДСКАЗКИ','REWARDS & HINTS')}</span><h1>{t('Реклама','Advertising')}</h1><p>{t('Добровольные награды остаются под серверным контролем.','Optional rewards remain under server control.')}</p></div></div><AdminAds/></>}
          </>}
        </section>
      </div>
    </div>
    <Dialog open={Boolean(selected)} onOpenChange={v=>{if(!v){detailGeneration.current++;setSelected(null);}}}><DialogContent className="small-dialog"><DialogTitle>{t('Прогресс','Progress')} · {selected?.username}</DialogTitle><DialogDescription>{t('Каждый язык и маршрут сохраняются отдельно.','Each language and route is saved separately.')}</DialogDescription>{progress===null?<p>{t('Загрузка…','Loading…')}</p>:progress.length?<ul className="admin-progress">{progress.map(p=><li key={p.language+p.difficulty}><span>{p.language==='cpp'?'C++':'Python'} · {difficultyLabel(p.difficulty,language)}</span><strong>{p.completed}/{['full','classic'].includes(p.difficulty)?15:5}</strong></li>)}</ul>:<p>{t('Игрок пока не сохранил прохождение.','This player has not saved progress yet.')}</p>}</DialogContent></Dialog>
    <Dialog open={Boolean(action)} onOpenChange={v=>{if(!v&&!saving)setAction(null);}}><DialogContent className="small-dialog"><DialogTitle>{action&&actionTitle(action.kind)}?</DialogTitle><DialogDescription>{action?.user.username}. {action?.kind==='unblock'?t('Игрок снова сможет войти.','The player will be able to sign in again.'):t('Все текущие сессии игрока будут завершены. Прогресс останется сохранён.','All current sessions will end. Progress will be kept.')}</DialogDescription><div className="dialog-actions"><button className="run-button" disabled={saving} onClick={()=>setAction(null)}>{t('Отмена','Cancel')}</button><button className="submit-button" disabled={saving} onClick={()=>void applyAction()}>{saving?t('Выполняем…','Working…'):t('Подтвердить','Confirm')}</button></div>{error&&<p role="alert" className="auth-error">{error}</p>}</DialogContent></Dialog>
  </main>;
}
