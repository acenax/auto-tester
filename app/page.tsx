'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Plus, Trash2, Activity, Eraser, Save, Code,
  Monitor, Link2, Download, Upload, Copy, ChevronUp,
  ChevronDown, Shield, ShieldOff, History, X, FileText,
  CheckCircle, XCircle, AlertCircle, StopCircle, Settings,
  GripVertical // ✨ 1. เพิ่ม GripVertical ตรงนี้
} from 'lucide-react';
import NextLink from 'next/link';

// ─── Types ───────────────────────────────────────────────────────────────────
type Action =
  | 'Click' | 'Input Text' | 'Check Box' | 'Uncheck Box'
  | 'Select Dropdown' | 'Press Key' | 'Hover' | 'Scroll'
  | 'Screenshot' | 'Extract Text' | 'Wait for URL'
  | 'Wait for Element' | 'Wait (Sec)'
  | 'Assert Text' | 'Assert URL' | 'Assert Visible'
  | 'Assert Hidden' | 'Assert Title' | 'Assert Count'
  | 'Wait Queue' | 'Notify LINE';

interface Step {
  id: number;
  action: Action;
  target: string;
  value: string;
  delay: string;
  stopOnError?: boolean;
  stopOnFail?: boolean;
}

interface LogEntry { msg: string; status: 'pass' | 'fail' | 'info' | 'warn'; }

interface StepResult { stepIndex: number | null; message: string; status: string; }

interface RunSummary {
  pass: number; fail: number; info: number; total: number;
  passRate: number; results: StepResult[];
  timestamp: string; url?: string; browserType?: string; workers?: number;
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  url: string;
  browserType: string;
  workers: number;
  summary: RunSummary;
  logs: LogEntry[];
  presetName?: string;
}

interface Preset {
  url: string; steps: Step[]; isStealth: boolean;
  workers: number; browserType: string;
}

// ─── Action metadata ─────────────────────────────────────────────────────────
const ACTIONS: Record<Action, { tLabel: string; vLabel: string; group: 'action' | 'assert' | 'wait' }> = {
  'Click': { tLabel: 'Selector', vLabel: '', group: 'action' },
  'Input Text': { tLabel: 'Selector', vLabel: 'ข้อความที่พิมพ์', group: 'action' },
  'Check Box': { tLabel: 'Selector', vLabel: '', group: 'action' },
  'Uncheck Box': { tLabel: 'Selector', vLabel: '', group: 'action' },
  'Select Dropdown': { tLabel: 'Selector', vLabel: 'ค่าที่เลือก', group: 'action' },
  'Press Key': { tLabel: 'Selector', vLabel: 'ชื่อปุ่ม เช่น Enter', group: 'action' },
  'Hover': { tLabel: 'Selector', vLabel: '', group: 'action' },
  'Scroll': { tLabel: 'Selector (ว่าง = scroll หน้า)', vLabel: 'x,y เช่น 0,600', group: 'action' },
  'Screenshot': { tLabel: '', vLabel: '"full" = เต็มหน้า', group: 'action' },
  'Extract Text': { tLabel: 'Selector', vLabel: '', group: 'action' },
  'Wait for URL': { tLabel: '', vLabel: 'URL ที่รอ', group: 'wait' },
  'Wait for Element': { tLabel: 'Selector', vLabel: 'timeout (วินาที)', group: 'wait' },
  'Wait (Sec)': { tLabel: '', vLabel: 'จำนวนวินาที', group: 'wait' },
  'Assert Text': { tLabel: 'Selector', vLabel: 'ข้อความที่คาด', group: 'assert' },
  'Assert URL': { tLabel: '', vLabel: 'URL ที่คาด (substring)', group: 'assert' },
  'Assert Visible': { tLabel: 'Selector', vLabel: '', group: 'assert' },
  'Assert Hidden': { tLabel: 'Selector', vLabel: '', group: 'assert' },
  'Assert Title': { tLabel: '', vLabel: 'Title ที่คาด', group: 'assert' },
  'Assert Count': { tLabel: 'Selector', vLabel: 'จำนวนที่คาด', group: 'assert' },
  'Wait Queue': { tLabel: 'Selector (spinner/คิว)', vLabel: '"notify" = แจ้ง LINE ระหว่างรอ', group: 'wait' },
  'Notify LINE': { tLabel: '', vLabel: 'ข้อความ (ว่าง = ใช้ template)', group: 'action' },
};

const ACTION_GROUPS = {
  'action': Object.keys(ACTIONS).filter(a => ACTIONS[a as Action].group === 'action') as Action[],
  'assert': Object.keys(ACTIONS).filter(a => ACTIONS[a as Action].group === 'assert') as Action[],
  'wait': Object.keys(ACTIONS).filter(a => ACTIONS[a as Action].group === 'wait') as Action[],
};

// ─── HTML → Selector ─────────────────────────────────────────────────────────
function htmlToSelectors(html: string) {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const el = doc.body.firstElementChild;
    if (!el) return null;
    const tag = el.tagName.toLowerCase();

    if (el.id) return { css: `#${CSS.escape(el.id)}`, xpath: `//${tag}[@id="${el.id}"]`, by: 'id' };
    const name = el.getAttribute('name');
    if (name) return { css: `${tag}[name="${name}"]`, xpath: `//${tag}[@name="${name}"]`, by: 'name' };
    const testid = el.getAttribute('data-testid');
    if (testid) return { css: `[data-testid="${testid}"]`, xpath: `//*[@data-testid="${testid}"]`, by: 'data-testid' };
    const aria = el.getAttribute('aria-label');
    if (aria) return { css: `${tag}[aria-label="${aria}"]`, xpath: `//${tag}[@aria-label="${aria}"]`, by: 'aria-label' };
    const ph = el.getAttribute('placeholder');
    if (ph) return { css: `${tag}[placeholder="${ph}"]`, xpath: `//${tag}[@placeholder="${ph}"]`, by: 'placeholder' };
    const txt = el.textContent?.trim().slice(0, 50);
    if (txt && ['button', 'a', 'label', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].includes(tag))
      return { css: `${tag}:has-text("${txt}")`, xpath: `//${tag}[normalize-space(text())="${txt}"]`, by: 'text' };
    const type = el.getAttribute('type');
    const cls = el.classList.length ? `.${Array.from(el.classList).slice(0, 2).join('.')}` : '';
    if (type) return { css: `${tag}[type="${type}"]${cls}`, xpath: `//${tag}[@type="${type}"]`, by: 'type' };
    if (el.classList.length) return { css: `${tag}.${Array.from(el.classList).slice(0, 2).join('.')}`, xpath: `//${tag}[contains(@class,"${el.classList[0]}")]`, by: 'class' };
    return { css: tag, xpath: `//${tag}`, by: 'tag only' };
  } catch { return null; }
}

// ─── Log color helper ─────────────────────────────────────────────────────────
const logColor = (status: string) => ({
  pass: 'text-emerald-400',
  fail: 'text-red-400',
  warn: 'text-amber-400',
  info: 'text-gray-400',
}[status] ?? 'text-gray-400');

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [url, setUrl] = useState('https://example.com');
  const [steps, setSteps] = useState<Step[]>([{ id: 1, action: 'Click', target: '', value: '', delay: '' }]);
  const [isStealth, setIsStealth] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [workers, setWorkers] = useState(1);
  const [browserType, setBrowserType] = useState('chromium');
  const [runMode, setRunMode] = useState<'launch' | 'connect'>('launch');
  const [debugPort, setDebugPort] = useState('9222');

  const [presets, setPresets] = useState<Record<string, Preset>>({});
  const [newPresetName, setNewPresetName] = useState('');
  const [activePreset, setActivePreset] = useState('');

  const [htmlInput, setHtmlInput] = useState('');
  const [converted, setConverted] = useState<ReturnType<typeof htmlToSelectors>>(null);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [viewEntry, setViewEntry] = useState<HistoryEntry | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // ✨ 2. ประกาศตัวแปรสำหรับระบบ Drag & Drop ไว้ตรงนี้ครับ ✨
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleReorder = (fromIndex: number, toIndex: number) => {
    setSteps(prevSteps => {
      const newSteps = [...prevSteps];
      const [movedStep] = newSteps.splice(fromIndex, 1);
      newSteps.splice(toIndex, 0, movedStep);
      return newSteps;
    });
  };
  // ───────────────────────────────────────────────────────────

  // load presets + history from localStorage
  useEffect(() => {
    try {
      const p = localStorage.getItem('atp_presets');
      if (p) setPresets(JSON.parse(p));
      const h = localStorage.getItem('atp_history');
      if (h) setHistory(JSON.parse(h));
    } catch { }
  }, []);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  // ── Preset ──────────────────────────────────────────────────────────────────
  const savePresets = (u: Record<string, Preset>) => {
    setPresets(u);
    localStorage.setItem('atp_presets', JSON.stringify(u));
  };
  const saveHistory = (h: HistoryEntry[]) => {
    const trimmed = h.slice(0, 50); // เก็บแค่ 50 รายการล่าสุด
    setHistory(trimmed);
    localStorage.setItem('atp_history', JSON.stringify(trimmed));
  };

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const name = newPresetName.trim();
    savePresets({ ...presets, [name]: { url, steps: JSON.parse(JSON.stringify(steps)), isStealth, workers, browserType } });
    setActivePreset(name); setNewPresetName('');
    addLog(`💾 บันทึก preset "${name}"`, 'info');
  };
  const handleOverwritePreset = () => {
    if (!activePreset) return;
    savePresets({ ...presets, [activePreset]: { url, steps: JSON.parse(JSON.stringify(steps)), isStealth, workers, browserType } });
    addLog(`🔄 อัปเดต "${activePreset}"`, 'info');
  };
  const handleLoadPreset = (name: string) => {
    const p = presets[name]; if (!p) return;
    setUrl(p.url || ''); setSteps(JSON.parse(JSON.stringify(p.steps || [])).map((s: Step, i: number) => ({ ...s, id: Date.now() + i })));
    setIsStealth(p.isStealth ?? true); setWorkers(p.workers || 1); setBrowserType(p.browserType || 'chromium');
    setActivePreset(name); addLog(`📂 โหลด "${name}"`, 'info');
  };
  const handleDeletePreset = (name: string) => {
    const u = { ...presets }; delete u[name]; savePresets(u);
    if (activePreset === name) setActivePreset('');
  };
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(presets, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'presets.json'; a.click();
  };
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => { try { savePresets({ ...presets, ...JSON.parse(ev.target?.result as string) }); addLog('📥 Import สำเร็จ', 'info'); } catch { addLog('❌ JSON ไม่ถูกต้อง', 'fail'); } };
    r.readAsText(file); e.target.value = '';
  };

  // ── Steps ───────────────────────────────────────────────────────────────────
  const addLog = (msg: string, status: LogEntry['status'] = 'info') =>
    setLogs(p => [...p, { msg, status }]);

  const addStep = () => setSteps(s => [...s, { id: Date.now(), action: 'Click', target: '', value: '', delay: '' }]);
  const updateStep = (id: number, field: keyof Step, val: any) =>
    setSteps(s => s.map(x => x.id === id ? { ...x, [field]: val } : x));
  const removeStep = (id: number) => setSteps(s => s.filter(x => x.id !== id));
  const moveStep = (id: number, dir: -1 | 1) => {
    setSteps(s => {
      const idx = s.findIndex(x => x.id === id), nxt = idx + dir;
      if (nxt < 0 || nxt >= s.length) return s;
      const a = [...s];[a[idx], a[nxt]] = [a[nxt], a[idx]]; return a;
    });
  };
  const dupStep = (id: number) => {
    setSteps(s => {
      const idx = s.findIndex(x => x.id === id);
      const a = [...s]; a.splice(idx + 1, 0, { ...s[idx], id: Date.now() }); return a;
    });
  };

  // ── Run (SSE streaming) ──────────────────────────────────────────────────────
  const runTest = async () => {
    setIsRunning(true); setLogs([]); setSummary(null);
    const endpoint = runMode === 'launch' ? '/api/run-test' : '/api/run-test/connect-test';

    // โหลด config จาก localStorage
    let appCfg: any = null;
    try { appCfg = JSON.parse(localStorage.getItem('atp_config') || 'null'); } catch { }

    const lineConfig = appCfg?.line?.token ? {
      token: appCfg.line.token,
      userId: appCfg.line.userId,
      imgbbKey: appCfg.imgbb?.apiKey,
      sendScreenshot: appCfg.notify?.sendScreenshot ?? true,
      defaultTemplate: appCfg.notify?.defaultTemplate,
      queuePassTemplate: appCfg.notify?.queuePassTemplate,
      queueFailTemplate: appCfg.notify?.queueFailTemplate,
      testCompleteTemplate: appCfg.notify?.testCompleteTemplate,
    } : null;

    const workerNames = (appCfg?.workers || []).map((w: any) => w.name).filter(Boolean);

    const payload = runMode === 'launch'
      ? { url, steps, useStealth: isStealth, workers: Number(workers), browserType, workerNames, lineConfig }
      : { port: Number(debugPort), steps, lineConfig, workerName: workerNames[0] || 'CDP' };

    const collectedLogs: LogEntry[] = [];

    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';

      abortRef.current = () => reader.cancel();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n');
          const eventLine = lines.find(l => l.startsWith('event:'));
          const dataLine = lines.find(l => l.startsWith('data:'));
          if (!eventLine || !dataLine) continue;

          const type = eventLine.replace('event:', '').trim();
          const data = JSON.parse(dataLine.replace('data:', '').trim());

          if (type === 'log') {
            const entry: LogEntry = { msg: data.msg, status: data.status || 'info' };
            collectedLogs.push(entry);
            setLogs(p => [...p, entry]);
          } else if (type === 'summary') {
            setSummary(data);
            // บันทึกลง history
            const entry: HistoryEntry = {
              id: Date.now().toString(), timestamp: data.timestamp || new Date().toISOString(),
              url: data.url || url, browserType: data.browserType || browserType,
              workers: data.workers || workers, summary: data, logs: [...collectedLogs],
              presetName: activePreset || undefined,
            };
            saveHistory([entry, ...history]);
          } else if (type === 'done') {
            break;
          }
        }
      }
    } catch (err: any) {
      if (!err.message.includes('cancel')) addLog(`❌ ${err.message}`, 'fail');
    } finally {
      setIsRunning(false); abortRef.current = null;
    }
  };

  const stopTest = () => { abortRef.current?.(); setIsRunning(false); addLog('⛔ หยุดรันแล้ว', 'warn'); };

  // ── Export report ────────────────────────────────────────────────────────────
  const exportReport = (entry: HistoryEntry) => {
    const report = {
      runAt: entry.timestamp, url: entry.url, browser: entry.browserType,
      workers: entry.workers, preset: entry.presetName,
      summary: { pass: entry.summary.pass, fail: entry.summary.fail, total: entry.summary.total, passRate: `${entry.summary.passRate}%` },
      steps: entry.summary.results,
      logs: entry.logs.map(l => `[${l.status.toUpperCase()}] ${l.msg}`),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `report_${entry.timestamp.replace(/[:.]/g, '-')}.json`; a.click();
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans overflow-hidden">

      {/* ══ ซ้าย: Steps ══════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col gap-3 p-4 overflow-hidden min-w-0">

        {/* Header */}
        <header className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-indigo-400 font-bold text-base tracking-tight">auto-tester</span>
            <div className="flex bg-gray-800 p-0.5 rounded-lg text-xs font-medium border border-gray-700">
              {(['launch', 'connect'] as const).map(m => (
                <button key={m} onClick={() => setRunMode(m)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${runMode === m ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                  {m === 'launch' ? <Monitor size={12} /> : <Link2 size={12} />}
                  {m === 'launch' ? 'เปิดจอใหม่' : 'สิงจอเดิม'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NextLink href="/settings"
              className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors" title="Settings">
              <Settings size={16} />
            </NextLink>
            <button onClick={() => setShowHistory(true)}
              className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors relative">
              <History size={16} />
              {history.length > 0 && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-indigo-400 rounded-full" />}
            </button>
            {isRunning
              ? <button onClick={stopTest} className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm bg-red-700 hover:bg-red-600 text-white transition-all">
                <StopCircle size={15} /> Stop
              </button>
              : <button onClick={runTest} className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-all">
                <Play size={15} /> Run Test
              </button>
            }
          </div>
        </header>

        {/* Config */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 shrink-0">
          {runMode === 'launch' ? (
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-5">
                <label className="text-xs text-gray-500 font-medium block mb-1.5">URL เป้าหมาย</label>
                <input value={url} onChange={e => setUrl(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 font-mono" />
              </div>
              <div className="col-span-3">
                <label className="text-xs text-gray-500 font-medium block mb-1.5">Browser</label>
                <select value={browserType} onChange={e => setBrowserType(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
                  {['chromium', 'chrome', 'firefox', 'webkit'].map(b => <option key={b} value={b}>{b === 'webkit' ? 'Safari' : b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 font-medium block mb-1.5">Workers</label>
                <input type="number" min="1" max="10" value={workers} onChange={e => setWorkers(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 text-center font-mono" />
              </div>
              <div className="col-span-2">
                <button onClick={() => setIsStealth(v => !v)}
                  className={`w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold border transition-all ${isStealth ? 'bg-emerald-900/40 border-emerald-700 text-emerald-300' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                  {isStealth ? <Shield size={12} /> : <ShieldOff size={12} />}
                  {isStealth ? 'Stealth ON' : 'Stealth OFF'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1.5">Debug Port</label>
                <input value={debugPort} onChange={e => setDebugPort(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-indigo-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 font-mono w-28" />
              </div>
              <div className="flex-1 bg-indigo-950/40 border border-indigo-900/50 rounded-lg px-4 py-2 text-xs text-indigo-300">
                เปิด Chrome ด้วย <code className="bg-indigo-900/50 px-1.5 rounded font-mono">chrome --remote-debugging-port=9222</code> แล้ว login ทิ้งไว้ก่อน
              </div>
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Steps</h3>
            <div className="flex gap-2 text-xs text-gray-600">
              <span className="text-emerald-600">{steps.filter(s => ACTIONS[s.action]?.group === 'assert').length} asserts</span>
              <span>·</span>
              <span>{steps.length} total</span>
            </div>
          </div>

          <div className="space-y-1.5">
            {steps.map((step, idx) => {
              const meta = ACTIONS[step.action];
              const isAssert = meta?.group === 'assert';
              const isWait = meta?.group === 'wait';

              // กำหนดสีพื้นฐาน
              const baseColorClass = isAssert
                ? 'bg-purple-950/30 border-purple-900/40 hover:border-purple-800/60'
                : isWait
                  ? 'bg-amber-950/20 border-amber-900/30 hover:border-amber-800/50'
                  : 'bg-gray-800/50 border-gray-700/40 hover:border-gray-600/60';

              return (
                <div
                  key={step.id}
                  draggable
                  onDragStart={() => setDraggedIndex(idx)}
                  onDragEnter={() => setDragOverIndex(idx)}
                  onDragEnd={() => {
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragOver={(e) => e.preventDefault()} // จำเป็นต้องมีเพื่อให้ Drop ได้
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedIndex !== null && draggedIndex !== idx) {
                      handleReorder(draggedIndex, idx);
                    }
                  }}
                  className={`group flex gap-2 items-center rounded-lg p-2 border transition-all duration-200 
                    ${baseColorClass}
                    ${draggedIndex === idx ? 'opacity-40 scale-[0.99] bg-gray-800/80 border-dashed' : ''} 
                    ${dragOverIndex === idx && draggedIndex !== idx ? 'border-t-2 border-t-indigo-400 shadow-lg translate-y-0.5' : ''}
                  `}
                >
                  {/* จุดจับสำหรับลาก (Grip) */}
                  <div className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-300 px-0.5 transition-colors">
                    <GripVertical size={14} />
                  </div>

                  <span className="text-xs text-gray-600 w-5 text-right font-mono shrink-0">{idx + 1}</span>

                  <select value={step.action} onChange={e => updateStep(step.id, 'action', e.target.value as Action)}
                    className={`rounded-md px-2 py-1.5 text-xs font-medium outline-none border w-40 shrink-0 bg-gray-900 focus:border-indigo-500 ${isAssert ? 'text-purple-300 border-purple-800/60' : isWait ? 'text-amber-300 border-amber-800/60' : 'text-indigo-300 border-gray-700'}`}>
                    <optgroup label="— Actions —">
                      {ACTION_GROUPS.action.map(a => <option key={a}>{a}</option>)}
                    </optgroup>
                    <optgroup label="— Assert —">
                      {ACTION_GROUPS.assert.map(a => <option key={a}>{a}</option>)}
                    </optgroup>
                    <optgroup label="— Wait —">
                      {ACTION_GROUPS.wait.map(a => <option key={a}>{a}</option>)}
                    </optgroup>
                  </select>

                  <input value={step.target} onChange={e => updateStep(step.id, 'target', e.target.value)}
                    placeholder={meta?.tLabel || '—'}
                    className="flex-1 bg-gray-900 border border-gray-700 text-gray-200 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 font-mono min-w-0 placeholder:text-gray-700" />

                  <input value={step.value} onChange={e => updateStep(step.id, 'value', e.target.value)}
                    placeholder={meta?.vLabel || '—'}
                    className="w-36 bg-gray-900 border border-gray-700 text-gray-200 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 shrink-0 placeholder:text-gray-700" />

                  <div className="flex items-center gap-1 shrink-0">
                    <input type="number" min="0" step="0.5" value={step.delay}
                      onChange={e => updateStep(step.id, 'delay', e.target.value)}
                      placeholder="0"
                      className="w-12 bg-gray-900 border border-gray-700 text-amber-300 rounded-md px-1.5 py-1.5 text-xs text-center outline-none focus:border-amber-600 font-mono"
                      title="delay วินาที" />
                    <span className="text-xs text-gray-700">s</span>
                  </div>

                  {isAssert && (
                    <button onClick={() => updateStep(step.id, 'stopOnFail', !step.stopOnFail)}
                      title="หยุดถ้า assert fail"
                      className={`p-1 rounded text-xs shrink-0 transition-colors ${step.stopOnFail ? 'text-red-400 bg-red-900/30' : 'text-gray-700 hover:text-gray-500'}`}>
                      <StopCircle size={13} />
                    </button>
                  )}

                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => moveStep(step.id, -1)} disabled={idx === 0} className="p-1 text-gray-600 hover:text-gray-300 disabled:opacity-20 rounded"><ChevronUp size={13} /></button>
                    <button onClick={() => moveStep(step.id, 1)} disabled={idx === steps.length - 1} className="p-1 text-gray-600 hover:text-gray-300 disabled:opacity-20 rounded"><ChevronDown size={13} /></button>
                    <button onClick={() => dupStep(step.id)} className="p-1 text-gray-600 hover:text-blue-400 rounded"><Copy size={13} /></button>
                    <button onClick={() => removeStep(step.id)} className="p-1 text-gray-600 hover:text-red-400 rounded"><Trash2 size={13} /></button>
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={addStep}
            className="mt-3 flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm font-medium px-2 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors">
            <Plus size={15} /> Add Step
          </button>
        </div>
      </div>

      {/* ══ ขวา: Tools + Logs ════════════════════════════════════════════════ */}
      <div className="w-80 flex flex-col gap-3 p-4 pl-0 overflow-y-auto shrink-0">

        {/* Preset */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Presets</h3>
            <div className="flex gap-1">
              <button onClick={handleExport} title="Export" className="p-1.5 text-gray-600 hover:text-gray-300 hover:bg-gray-800 rounded-md transition-colors"><Download size={12} /></button>
              <button onClick={() => fileInputRef.current?.click()} title="Import" className="p-1.5 text-gray-600 hover:text-gray-300 hover:bg-gray-800 rounded-md transition-colors"><Upload size={12} /></button>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            </div>
          </div>
          <div className="flex gap-2 mb-2">
            <input value={newPresetName} onChange={e => setNewPresetName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSavePreset()}
              placeholder="ชื่อ preset..."
              className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500 min-w-0" />
            <button onClick={handleSavePreset} className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1">
              <Save size={11} /> Save
            </button>
          </div>
          {activePreset && (
            <div className="flex items-center justify-between bg-amber-900/30 border border-amber-800/40 rounded-lg px-3 py-2 mb-2">
              <span className="text-xs text-amber-300 truncate mr-2">📂 {activePreset}</span>
              <button onClick={handleOverwritePreset} className="shrink-0 text-xs bg-amber-700 hover:bg-amber-600 text-white px-2 py-1 rounded-md font-semibold">Update</button>
            </div>
          )}
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {Object.keys(presets).length === 0
              ? <p className="text-xs text-gray-700 text-center py-2">ยังไม่มี preset</p>
              : Object.keys(presets).map(name => (
                <div key={name} onClick={() => handleLoadPreset(name)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg group cursor-pointer text-xs transition-colors ${activePreset === name ? 'bg-indigo-900/40 border border-indigo-700/50 text-indigo-300' : 'hover:bg-gray-800 text-gray-400'}`}>
                  <span className="truncate flex-1">📂 {name}</span>
                  <button onClick={e => { e.stopPropagation(); handleDeletePreset(name); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-600 hover:text-red-400 rounded ml-1 transition-all"><Trash2 size={10} /></button>
                </div>
              ))}
          </div>
        </div>

        {/* HTML Converter */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Code size={13} className="text-indigo-400" />
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">HTML → Selector</h3>
          </div>
          <textarea rows={2} value={htmlInput} onChange={e => { setHtmlInput(e.target.value); setConverted(htmlToSelectors(e.target.value.trim())); }}
            placeholder='<button id="login-btn">เข้าสู่ระบบ</button>'
            className="w-full bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-indigo-500 resize-none" />
          {converted && (
            <div className="mt-2 bg-gray-800/60 border border-gray-700 rounded-lg p-3 space-y-2">
              <div>
                <div className="flex justify-between mb-0.5">
                  <span className="text-[10px] text-indigo-400 font-semibold uppercase">CSS selector</span>
                  <span className="text-[10px] text-gray-600">by {converted.by}</span>
                </div>
                <code className="block text-xs font-mono text-indigo-200 bg-indigo-950/50 px-2 py-1 rounded break-all select-all">{converted.css}</code>
              </div>
              <div>
                <span className="text-[10px] text-teal-400 font-semibold uppercase block mb-0.5">XPath</span>
                <code className="block text-xs font-mono text-teal-200 bg-teal-950/30 px-2 py-1 rounded break-all select-all">{converted.xpath}</code>
              </div>
              <div className="flex gap-1.5 pt-0.5">
                <button onClick={() => { updateStep(steps[steps.length - 1].id, 'target', converted!.css); setHtmlInput(''); setConverted(null); addLog('🎯 ใส่ selector ใน step สุดท้าย', 'info'); }}
                  className="flex-1 bg-indigo-700 hover:bg-indigo-600 text-white text-[11px] py-1.5 rounded-md font-semibold">ใส่ step สุดท้าย</button>
                <button onClick={() => { setSteps(s => [...s, { id: Date.now(), action: 'Click', target: converted!.css, value: '', delay: '' }]); setHtmlInput(''); setConverted(null); }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-[11px] py-1.5 rounded-md font-semibold">step ใหม่</button>
              </div>
            </div>
          )}
        </div>

        {/* Summary bar */}
        {summary && (
          <div className={`border rounded-xl p-3 shrink-0 ${summary.fail > 0 ? 'bg-red-950/30 border-red-900/50' : 'bg-emerald-950/30 border-emerald-900/50'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-300">ผลรันล่าสุด</span>
              <span className={`text-xs font-bold ${summary.fail > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{summary.passRate}%</span>
            </div>
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5">
                <CheckCircle size={13} className="text-emerald-400" />
                <span className="text-xs text-emerald-300 font-semibold">{summary.pass} pass</span>
              </div>
              <div className="flex items-center gap-1.5">
                <XCircle size={13} className="text-red-400" />
                <span className="text-xs text-red-300 font-semibold">{summary.fail} fail</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertCircle size={13} className="text-gray-500" />
                <span className="text-xs text-gray-500">{summary.total} steps</span>
              </div>
            </div>
            {/* progress bar */}
            <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${summary.passRate}%` }} />
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="bg-gray-950 border border-gray-800 rounded-xl flex flex-col flex-1 min-h-48 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-2">
              <Activity size={12} className={isRunning ? 'text-green-400 animate-pulse' : 'text-gray-700'} />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Logs</span>
              {logs.length > 0 && <span className="text-[10px] text-gray-700 font-mono">{logs.length}</span>}
            </div>
            <button onClick={() => setLogs([])} className="p-1 text-gray-700 hover:text-gray-400 hover:bg-gray-800 rounded-md transition-colors">
              <Eraser size={11} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
            {logs.length === 0 ? <span className="text-xs text-gray-700 font-mono">รอรับคำสั่ง...</span>
              : logs.map((log, i) => (
                <div key={i} className={`text-[11px] font-mono leading-relaxed break-all ${logColor(log.status)}`}>{log.msg}</div>
              ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {/* ══ History modal ════════════════════════════════════════════════════ */}
      {showHistory && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <History size={16} className="text-indigo-400" />
                <h2 className="font-semibold text-gray-100">Run History</h2>
                <span className="text-xs text-gray-600 font-mono">{history.length} runs</span>
              </div>
              <button onClick={() => setShowHistory(false)} className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg"><X size={15} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {history.length === 0
                ? <p className="text-sm text-gray-600 text-center py-8">ยังไม่มีประวัติการรัน</p>
                : history.map(entry => (
                  <div key={entry.id}
                    className={`border rounded-xl p-3 cursor-pointer hover:border-gray-600 transition-colors ${entry.summary.fail > 0 ? 'border-red-900/40 bg-red-950/20' : 'border-emerald-900/30 bg-emerald-950/10'}`}
                    onClick={() => setViewEntry(entry)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {entry.summary.fail > 0
                          ? <XCircle size={14} className="text-red-400 shrink-0" />
                          : <CheckCircle size={14} className="text-emerald-400 shrink-0" />}
                        <span className="text-xs font-mono text-gray-300 truncate">{entry.url}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className={`text-xs font-bold ${entry.summary.fail > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{entry.summary.passRate}%</span>
                        <button onClick={e => { e.stopPropagation(); exportReport(entry); }}
                          className="p-1 text-gray-600 hover:text-gray-300 hover:bg-gray-800 rounded transition-colors">
                          <FileText size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-1.5 text-[10px] text-gray-600">
                      <span>{new Date(entry.timestamp).toLocaleString('th-TH')}</span>
                      <span>{entry.browserType}</span>
                      {entry.presetName && <span className="text-indigo-500">📂 {entry.presetName}</span>}
                      <span className="text-emerald-600">{entry.summary.pass}P</span>
                      {entry.summary.fail > 0 && <span className="text-red-500">{entry.summary.fail}F</span>}
                    </div>
                  </div>
                ))}
            </div>
            {history.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-800">
                <button onClick={() => { saveHistory([]); }} className="text-xs text-gray-600 hover:text-red-400 transition-colors">ล้างประวัติทั้งหมด</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Entry detail modal ═══════════════════════════════════════════════ */}
      {viewEntry && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div>
                <h2 className="font-semibold text-gray-100 text-sm">{viewEntry.url}</h2>
                <p className="text-xs text-gray-600 mt-0.5">{new Date(viewEntry.timestamp).toLocaleString('th-TH')} · {viewEntry.browserType} · {viewEntry.workers} worker(s)</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => exportReport(viewEntry)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors">
                  <FileText size={12} /> Export JSON
                </button>
                <button onClick={() => setViewEntry(null)} className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg"><X size={15} /></button>
              </div>
            </div>
            {/* summary */}
            <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-6">
              <div className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-400" /><span className="text-sm font-semibold text-emerald-300">{viewEntry.summary.pass} pass</span></div>
              <div className="flex items-center gap-2"><XCircle size={14} className="text-red-400" /><span className="text-sm font-semibold text-red-300">{viewEntry.summary.fail} fail</span></div>
              <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${viewEntry.summary.passRate}%` }} />
              </div>
              <span className={`text-sm font-bold ${viewEntry.summary.fail > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{viewEntry.summary.passRate}%</span>
            </div>
            {/* logs */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-0.5">
              {viewEntry.logs.map((log, i) => (
                <div key={i} className={`text-[11px] font-mono leading-relaxed ${logColor(log.status)}`}>{log.msg}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
