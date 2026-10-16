"use client";
import {useState} from 'react';
import Editor, { loader } from '@monaco-editor/react';
import {useLanguage} from '@/lib/i18n';
loader.config({ paths: { vs: '/runtime/monaco/vs' } });
export default function PythonEditor({ value, onChange, disabled, language='python',noPaste=false,onSubmit }: { value: string; onChange: (value: string) => void; disabled: boolean; language?:'python'|'cpp';noPaste?:boolean;onSubmit?:()=>void }) {
  const {t}=useLanguage();
  const [notice,setNotice]=useState('');
  const block=(e:{preventDefault:()=>void;stopPropagation:()=>void})=>{if(noPaste){e.preventDefault();e.stopPropagation();setNotice(t('В дуэли вводи решение вручную. Вставка и перетаскивание отключены.','Type your duel solution yourself. Pasting and dropping are disabled.'));}};
  return <div className="editor-shell" onPasteCapture={block} onDropCapture={block} onDragOver={e=>{if(noPaste)e.preventDefault();}}
    onBeforeInputCapture={e=>{if(['insertFromPaste','insertFromDrop','insertFromPasteAsQuotation'].includes((e.nativeEvent as InputEvent).inputType))block(e);}}
    onKeyDownCapture={e=>{if(((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v')||(e.shiftKey&&e.key==='Insert'))block(e);if(onSubmit&&(e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();e.stopPropagation();if(!disabled)onSubmit();}}}>
    {noPaste&&notice&&<p className="editor-notice" role="status">{notice}</p>}
    <Editor height="100%" language={language} value={value} onChange={v => onChange(v ?? '')} theme="vs-dark" loading={<div className="editor-loading">{t('Подключение редактора…','Loading editor…')}</div>}
    beforeMount={monaco => monaco.editor.defineTheme('climb', { base:'vs-dark', inherit:true, rules:[{token:'comment',foreground:'65847C'},{token:'keyword',foreground:'D6DE78'},{token:'string',foreground:'B6DDA6'},{token:'number',foreground:'98D9DF'}], colors:{'editor.background':'#0B171B','editor.foreground':'#DEECEA','editorLineNumber.foreground':'#4D6468','editorLineNumber.activeForeground':'#E5DD84','editor.lineHighlightBackground':'#12252A','editorCursor.foreground':'#E5DD84','editor.selectionBackground':'#27494E'} })}
    onMount={(_,monaco)=>monaco.editor.setTheme('climb')}
    options={{fontSize:15,fontFamily:'Consolas, monospace',fontLigatures:false,minimap:{enabled:false},scrollBeyondLastLine:false,automaticLayout:true,tabSize:4,insertSpaces:true,wordWrap:'on',padding:{top:20},readOnly:disabled,renderLineHighlight:'line',overviewRulerLanes:0,hideCursorInOverviewRuler:true,contextmenu:false,editContext:false,ariaLabel:t(`Редактор кода ${language==='python'?'Python':'C++'}`,`${language==='python'?'Python':'C++'} code editor`)}} /></div>;
}
