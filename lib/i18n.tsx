'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';

export type SiteLanguage='ru'|'en';
type LanguageState={language:SiteLanguage;setLanguage:(next:SiteLanguage)=>void;t:(ru:string,en:string)=>string};
const Context=createContext<LanguageState>({language:'ru',setLanguage:()=>{},t:ru=>ru});
export const useLanguage=()=>useContext(Context);

export function LanguageProvider({children}:{children:ReactNode}){
  const [language,setLanguage]=useState<SiteLanguage>('ru');
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{
    let active=true;
    void Promise.resolve().then(()=>{
      if(!active)return;
      try{const chosen=new URLSearchParams(window.location.search).get('lang');const saved=localStorage.getItem('code-climb-ui-language');setLanguage(chosen==='en'||chosen==='ru'?chosen:saved==='en'||saved==='ru'?saved:navigator.language.toLowerCase().startsWith('ru')?'ru':'en');}
      catch{setLanguage(navigator.language.toLowerCase().startsWith('ru')?'ru':'en');}
      setLoaded(true);
    });
    return()=>{active=false;};
  },[]);
  useEffect(()=>{if(!loaded)return;document.documentElement.lang=language;try{localStorage.setItem('code-climb-ui-language',language);}catch{}},[language,loaded]);
  return <Context.Provider value={{language,setLanguage:(next)=>{setLanguage(next);setLoaded(true);},t:(ru,en)=>language==='en'?en:ru}}>{children}</Context.Provider>;
}

export function LanguageSwitcher(){
  const {language,setLanguage}=useLanguage();
  return <div className="language-switch" role="group" aria-label={language==='ru'?'Язык интерфейса':'Interface language'}>
    <button type="button" lang="ru" aria-pressed={language==='ru'} onClick={()=>setLanguage('ru')}>RU</button>
    <button type="button" lang="en" aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>EN</button>
  </div>;
}
