"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Code2, Flag, Gauge, Mountain, Play, RotateCcw, Send, Sparkles, TerminalSquare, Timer, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Language = "python" | "cpp";
type Screen = "home" | "path" | "game";
type TestState = "idle" | "running" | "passed" | "failed";
type NodeData = { id: number; x: number; y: number; title: string; tag: string };

const routeNodes: NodeData[] = [
  { id: 1, x: 50, y: 91, title: "First Signal", tag: "BASIC LOGIC" },
  { id: 2, x: 44, y: 84, title: "Missing Number", tag: "ARRAYS" },
  { id: 3, x: 56, y: 77, title: "Mirror Words", tag: "STRINGS" },
  { id: 4, x: 39, y: 69, title: "Frequency Map", tag: "HASH MAP" },
  { id: 5, x: 26, y: 61, title: "Last In", tag: "STACK" },
  { id: 6, x: 45, y: 55, title: "Echo Chamber", tag: "RECURSION" },
  { id: 7, x: 64, y: 62, title: "Breadth First", tag: "QUEUE / BFS" },
  { id: 8, x: 69, y: 51, title: "Deep Trail", tag: "DFS" },
  { id: 9, x: 53, y: 43, title: "Order Restored", tag: "SORTING" },
  { id: 10, x: 34, y: 46, title: "Split Search", tag: "BINARY SEARCH" },
  { id: 11, x: 40, y: 35, title: "Ancient Tree", tag: "TREES" },
  { id: 12, x: 61, y: 32, title: "The Network", tag: "GRAPHS" },
  { id: 13, x: 70, y: 22, title: "Memory Steps", tag: "DYNAMIC PROGRAMMING" },
  { id: 14, x: 48, y: 18, title: "Thin Air", tag: "OPTIMIZATION" },
  { id: 15, x: 50, y: 7, title: "Summit Protocol", tag: "FINAL CHALLENGE" },
];

const pythonStarter = `def first_signal(numbers):
    # Return the sum of all positive numbers
    pass`;
const cppStarter = `int firstSignal(vector<int>& numbers) {
    // Return the sum of all positive numbers
    return 0;
}`;

const leaderboard = [
  { name: "nova", level: 12, avatar: "NV", height: "7 410 m" },
  { name: "cipher", level: 9, avatar: "CP", height: "5 350 m" },
  { name: "raven", level: 7, avatar: "RV", height: "4 120 m" },
  { name: "root", level: 5, avatar: "RT", height: "2 940 m" },
];

function nodeStatus(id: number, current: number) {
  if (id < current) return "cleared";
  if (id === current) return "current";
  if (id === current + 1) return "available";
  return "locked";
}

function MountainMap({ currentLevel, onSelect }: { currentLevel: number; onSelect: (node: NodeData) => void }) {
  const current = routeNodes[Math.min(currentLevel - 1, routeNodes.length - 1)];
  const route = routeNodes.map((node) => `${node.x},${node.y}`).join(" ");
  return (
    <div className="mountain-stage" aria-label="Mountain route">
      <div className="altitude-label top-altitude">8 848 M</div>
      <div className="altitude-label mid-altitude">4 000 M</div>
      <div className="altitude-label base-altitude">BASE CAMP</div>
      <svg className="mountain-map" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="mountain-title mountain-description">
        <title id="mountain-title">CODE CLIMB challenge route</title>
        <desc id="mountain-description">Fifteen programming levels lead from base camp to the summit.</desc>
        <defs>
          <linearGradient id="mountain-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#183651" stopOpacity="0.82" /><stop offset="70%" stopColor="#091826" stopOpacity="0.94" /><stop offset="100%" stopColor="#050b12" /></linearGradient>
          <filter id="node-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="1.4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <path className="mountain-silhouette" d="M5 98 L13 83 L21 78 L29 63 L36 59 L43 39 L50 22 L56 34 L62 26 L68 42 L75 50 L83 67 L95 98 Z" fill="url(#mountain-fill)" />
        <path className="snow-line" d="M43 39 L50 22 L56 34 L62 26 L68 42 L62 39 L57 42 L52 34 L48 42 Z" />
        <polyline className="route-shadow" points={route} /><polyline className="route-line" points={route} />
        {routeNodes.slice(0, -1).map((node) => {
          const status = nodeStatus(node.id, currentLevel);
          const enabled = status === "current" || status === "available";
          return <g key={node.id} className={`route-node route-node-${status}`} role="button" tabIndex={enabled ? 0 : -1} aria-label={`Level ${node.id}: ${node.title}, ${status}`} onClick={() => enabled && onSelect(node)} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && enabled && onSelect(node)}>
            <circle className="node-hit" cx={node.x} cy={node.y} r="3.2" />
            <rect className="node-box" x={node.x - 1.55} y={node.y - 1.55} width="3.1" height="3.1" rx="0.5" filter={status === "current" ? "url(#node-glow)" : undefined} />
            {status === "locked" && <circle className="node-lock" cx={node.x} cy={node.y} r="0.45" />}
            {status === "current" && <text className="node-pulse-label" x={node.x} y={node.y - 4.3} textAnchor="middle">LEVEL {String(node.id).padStart(2, "0")}</text>}
          </g>;
        })}
        <g className={`route-node route-node-${nodeStatus(15, currentLevel)}`} role="button" tabIndex={currentLevel >= 15 ? 0 : -1} onClick={() => currentLevel >= 15 && onSelect(routeNodes[14])}>
          <circle className="node-hit" cx="50" cy="7" r="4" /><path className="summit-flag" d="M49.2 9.5V3.2M49.5 3.5h5l-1.4 1.5 1.4 1.5h-5" />
        </g>
        <g className="player-marker" style={{ transform: `translate(${current.x}px, ${current.y}px)` }} aria-label="Your position">
          <circle r="3.7" /><path d="M-1.25 0.5h2.5M-0.75-0.9h1.5M-1.6 1.5v1.2M1.6 1.5v1.2" /><rect x="-1.75" y="-1.8" width="3.5" height="3.4" rx="0.8" /><circle cx="-0.65" cy="-0.2" r="0.3" /><circle cx="0.65" cy="-0.2" r="0.3" />
        </g>
      </svg>
      <div className="map-hint"><span className="live-dot" /> ACTIVE ROUTE · {15 - currentLevel + 1} CHECKPOINTS LEFT</div>
    </div>
  );
}

function HomeScreen({ onStart }: { onStart: () => void }) {
  return <main className="intro-shell">
    <div className="intro-grid" aria-hidden="true" /><div className="intro-mountain" aria-hidden="true"><Mountain size={560} strokeWidth={0.7} /></div>
    <section className="intro-content">
      <div className="brand-mark"><span>CC</span></div><p className="eyebrow"><span /> SYSTEM ONLINE · SEASON 01</p>
      <h1>CODE<br /><em>CLIMB</em></h1><p className="intro-copy">Solve the challenge. Gain altitude.<br />Reach the summit.</p>
      <Button className="primary-cta" size="lg" onClick={onStart}>BEGIN ASCENT <ChevronRight /></Button>
      <div className="intro-stats" aria-label="Game statistics"><div><strong>15</strong><span>CHECKPOINTS</span></div><div><strong>2</strong><span>LANGUAGES</span></div><div><strong>8 848</strong><span>METERS</span></div></div>
    </section><p className="intro-coordinate">47°00′N · 86°56′E<br />BASE CAMP / 5 364 M</p>
  </main>;
}

function PathScreen({ progress, onChoose, onBack }: { progress: Record<Language, number>; onChoose: (language: Language) => void; onBack: () => void }) {
  return <main className="path-shell">
    <div className="path-header"><button className="text-button" onClick={onBack}>← BACK TO BASE</button><div className="mini-brand">CODE<span>CLIMB</span></div><div className="system-state"><span className="live-dot" /> ONLINE</div></div>
    <section className="path-content"><p className="eyebrow"><span /> CHOOSE YOUR DISCIPLINE</p><h2>SELECT YOUR PATH</h2><p>Each route has its own challenges and separate progress.</p>
      <div className="path-grid">
        {(["python", "cpp"] as Language[]).map((item, index) => <button key={item} className="path-card" onClick={() => onChoose(item)}>
          <div className="path-number">0{index + 1}</div><div className={`language-glyph ${item === "cpp" ? "cpp-glyph" : ""}`}>{item === "python" ? "PY" : "C+"}</div>
          <div><span className="path-kicker">{item === "python" ? "INTERPRETED ROUTE" : "COMPILED ROUTE"}</span><h3>{item === "python" ? "PYTHON" : "C++"}</h3><p>{item === "python" ? "Logic, data structures and algorithms." : "Systems, memory and high performance."}</p></div>
          <div className="path-progress"><span><b>{Math.max(progress[item] - 1, 0)}</b> / 15 COMPLETE</span><i><b style={{ width: `${((progress[item] - 1) / 15) * 100}%` }} /></i></div><ChevronRight className="path-arrow" />
        </button>)}
      </div>
    </section>
  </main>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [language, setLanguage] = useState<Language>("python");
  const [progress, setProgress] = useState<Record<Language, number>>({ python: 1, cpp: 1 });
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [code, setCode] = useState(pythonStarter);
  const [testState, setTestState] = useState<TestState>("idle");
  const [visibleTests, setVisibleTests] = useState(0);

  useEffect(() => { const stored = window.localStorage.getItem("code-climb-progress"); if (stored) { try { const parsed = JSON.parse(stored) as Partial<Record<Language, number>>; setProgress({ python: parsed.python ?? 1, cpp: parsed.cpp ?? 1 }); } catch { window.localStorage.removeItem("code-climb-progress"); } } }, []);
  useEffect(() => { window.localStorage.setItem("code-climb-progress", JSON.stringify(progress)); }, [progress]);

  const currentLevel = progress[language];
  const currentNode = routeNodes[Math.min(currentLevel - 1, routeNodes.length - 1)];
  const altitude = Math.round(500 + ((currentLevel - 1) / 14) * 8348);
  const routeCompletion = useMemo(() => Math.round(((currentLevel - 1) / routeNodes.length) * 100), [currentLevel]);

  function chooseLanguage(next: Language) { setLanguage(next); setCode(next === "python" ? pythonStarter : cppStarter); setScreen("game"); }
  function openChallenge(node: NodeData) { if (node.id !== currentLevel) return; setSelectedNode(node); setTestState("idle"); setVisibleTests(0); }
  function runTests(isSubmit: boolean) {
    setTestState("running"); setVisibleTests(1); const total = isSubmit ? 5 : 3; let shown = 1;
    const interval = window.setInterval(() => { shown += 1; setVisibleTests(Math.min(shown, total)); if (shown >= total) { window.clearInterval(interval); const valid = language === "python" ? !/\bpass\b/.test(code) && /return/.test(code) : !/return\s+0\s*;/.test(code) && /return/.test(code); window.setTimeout(() => { setTestState(valid ? "passed" : "failed"); if (valid && isSubmit) window.setTimeout(() => { setProgress((old) => ({ ...old, [language]: Math.min(old[language] + 1, 15) })); setSelectedNode(null); }, 850); }, 300); } }, 280);
  }

  if (screen === "home") return <HomeScreen onStart={() => setScreen("path")} />;
  if (screen === "path") return <PathScreen progress={progress} onChoose={chooseLanguage} onBack={() => setScreen("home")} />;

  return <main className="game-shell">
    <header className="game-header"><button className="game-brand" onClick={() => setScreen("home")} aria-label="Back to main menu"><span className="brand-mark small"><span>CC</span></span><span>CODE <b>CLIMB</b></span></button><nav className="language-switch" aria-label="Programming language"><button className={language === "python" ? "active" : ""} onClick={() => chooseLanguage("python")}>PYTHON</button><button className={language === "cpp" ? "active" : ""} onClick={() => chooseLanguage("cpp")}>C++</button></nav><div className="header-status"><span className="weather"><span>−12°C</span><small>WIND 24 KM/H</small></span><button className="profile-button" aria-label="Player profile">EC</button></div></header>
    <div className="game-layout">
      <aside className="mission-panel"><div className="panel-label"><Mountain /> ASCENT STATUS</div><div className="altitude-block"><span>CURRENT ALTITUDE</span><strong>{altitude.toLocaleString("ru-RU")}</strong><b>M</b><div className="altitude-change">▲ +{currentLevel === 1 ? 0 : 596} M TODAY</div></div><div className="mission-separator" />
        <section className="next-mission"><div className="section-number">NEXT CHECKPOINT <b>{String(currentLevel).padStart(2, "0")}</b></div><span className="challenge-tag">{currentNode.tag}</span><h2>{currentNode.title}</h2><p>{currentLevel === 1 ? "Return the sum of every positive number in the expedition data." : "Open the checkpoint to inspect the next programming objective."}</p><Button className="mission-button" onClick={() => openChallenge(currentNode)}>OPEN CHALLENGE <ChevronRight /></Button></section>
        <div className="mission-separator" /><div className="route-progress"><span><b>ROUTE PROGRESS</b><em>{routeCompletion}%</em></span><div><i style={{ width: `${routeCompletion}%` }} /></div><small>SUMMIT: {Math.max(8848 - altitude, 0).toLocaleString("ru-RU")} M REMAINING</small></div><div className="loadout"><span><TerminalSquare /> {language === "python" ? "PYTHON 3.12" : "G++ 14"}</span><span><Timer /> 2.0 SEC</span><span><Gauge /> 128 MB</span></div>
      </aside>
      <section className="map-panel"><div className="map-title"><span>ROUTE // {language.toUpperCase()}</span><h1>THE NORTH FACE</h1></div><MountainMap currentLevel={currentLevel} onSelect={openChallenge} /><div className="map-legend"><span><i className="legend-cleared" /> CLEARED</span><span><i className="legend-current" /> CURRENT</span><span><i className="legend-locked" /> LOCKED</span></div></section>
      <aside className="leaderboard-panel"><div className="panel-label"><Trophy /> LIVE LEADERBOARD</div><div className="season-row"><span>SEASON 01</span><b><span className="live-dot" /> LIVE</b></div><ol className="leader-list">{leaderboard.map((player, index) => <li key={player.name}><span className="rank">{String(index + 1).padStart(2, "0")}</span><span className="leader-avatar">{player.avatar}</span><span className="leader-name"><b>{player.name}</b><small>LEVEL {player.level}</small></span><span className="leader-height">{player.height}</span></li>)}<li className="you-row"><span className="rank">05</span><span className="leader-avatar you-avatar">EC</span><span className="leader-name"><b>you</b><small>LEVEL {currentLevel}</small></span><span className="leader-height">{altitude.toLocaleString("ru-RU")} m</span></li></ol><div className="summit-card"><Flag /><span><b>SUMMIT RECORD</b><strong>00:47:32</strong><small>HELD BY NOVA</small></span></div><button className="reset-link" onClick={() => setProgress((old) => ({ ...old, [language]: 1 }))}><RotateCcw /> RESET {language.toUpperCase()} PROGRESS</button></aside>
    </div>
    <Dialog open={Boolean(selectedNode)} onOpenChange={(open) => !open && setSelectedNode(null)}><DialogContent className="challenge-dialog" showCloseButton={false}><DialogHeader className="challenge-heading"><div><span>CHECKPOINT {String(selectedNode?.id ?? 1).padStart(2, "0")} · {selectedNode?.tag}</span><DialogTitle>{selectedNode?.title}</DialogTitle><DialogDescription>Return the sum of every positive integer. Ignore zero and negative values.</DialogDescription></div><button className="close-dialog" onClick={() => setSelectedNode(null)} aria-label="Close challenge"><X /></button></DialogHeader>
      <div className="challenge-body"><section className="brief-panel"><h3>MISSION BRIEF</h3><p>Expedition sensors returned a list of altitude changes. Calculate the useful climb by adding only positive values.</p><div className="example-block"><span>EXAMPLE</span><code>Input: [-2, 4, 1, -3, 6]</code><code>Output: 11</code></div><h4>CONSTRAINTS</h4><ul><li>1 ≤ numbers.length ≤ 100 000</li><li>−10⁶ ≤ numbers[i] ≤ 10⁶</li></ul><div className="limits-grid"><span><Timer /> TIME<b>2 SEC</b></span><span><Gauge /> MEMORY<b>128 MB</b></span></div></section>
        <section className="editor-panel"><div className="editor-toolbar"><span><Code2 /> solution.{language === "python" ? "py" : "cpp"}</span><b>{language === "python" ? "PYTHON 3.12" : "C++ 23"}</b></div><div className="editor-wrap"><div className="line-numbers" aria-hidden="true">1<br />2<br />3<br />4<br />5<br />6<br />7<br />8</div><textarea aria-label="Code editor" spellCheck={false} value={code} onChange={(event) => setCode(event.target.value)} /></div>
          <div className={`test-console console-${testState}`} aria-live="polite">{testState === "idle" && <span>READY — run public examples or submit for hidden tests.</span>}{testState === "running" && <span><i className="console-spinner" /> RUNNING TESTS… {visibleTests}/5</span>}{testState === "passed" && <span><Sparkles /> ALL TESTS PASSED — CHECKPOINT CLEARED</span>}{testState === "failed" && <span>TEST 2 FAILED — expected 11, received 0</span>}</div>
          <div className="editor-actions"><Button variant="outline" onClick={() => setCode(language === "python" ? pythonStarter : cppStarter)}><RotateCcw /> RESET</Button><span /><Button variant="outline" onClick={() => runTests(false)} disabled={testState === "running"}><Play /> RUN</Button><Button className="submit-button" onClick={() => runTests(true)} disabled={testState === "running"}><Send /> SUBMIT</Button></div>
        </section></div>
    </DialogContent></Dialog>
  </main>;
}
