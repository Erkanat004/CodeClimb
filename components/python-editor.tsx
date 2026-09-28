"use client";
import Editor, { loader } from '@monaco-editor/react';
loader.config({ paths: { vs: '/runtime/monaco/vs' } });
export default function PythonEditor({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <Editor height="100%" language="python" value={value} onChange={v => onChange(v ?? '')} theme="vs-dark" loading={<div className="editor-loading">Подключение редактора…</div>}
    beforeMount={monaco => monaco.editor.defineTheme('climb', { base:'vs-dark', inherit:true, rules:[{token:'comment',foreground:'65847C'},{token:'keyword',foreground:'D6DE78'},{token:'string',foreground:'B6DDA6'},{token:'number',foreground:'98D9DF'}], colors:{'editor.background':'#0B171B','editor.foreground':'#DEECEA','editorLineNumber.foreground':'#4D6468','editorLineNumber.activeForeground':'#E5DD84','editor.lineHighlightBackground':'#12252A','editorCursor.foreground':'#E5DD84','editor.selectionBackground':'#27494E'} })}
    onMount={(_,monaco)=>monaco.editor.setTheme('climb')}
    options={{fontSize:15,fontFamily:'Consolas, monospace',fontLigatures:false,minimap:{enabled:false},scrollBeyondLastLine:false,automaticLayout:true,tabSize:4,insertSpaces:true,wordWrap:'on',padding:{top:20},readOnly:disabled,renderLineHighlight:'line',overviewRulerLanes:0,hideCursorInOverviewRuler:true,contextmenu:false,editContext:false,ariaLabel:'Редактор кода Python'}} />;
}
