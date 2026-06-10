'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Save, Plus, Trash2, Eye, EyeOff, ArrowLeft, RefreshCw,
  MessageSquare, Image as ImageIcon, Bot, Users, Bell,
  RotateCcw, CheckCircle, ExternalLink, AlertTriangle, ChevronDown
} from 'lucide-react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────
interface WorkerConfig { id: number; name: string; color: string; }
interface AppConfig {
  line:   { token: string; userId: string };
  imgbb:  { apiKey: string };
  workers: WorkerConfig[];
  notify: {
    defaultTemplate: string;
    queuePassTemplate: string;
    queueFailTemplate: string;
    testCompleteTemplate: string;
    sendScreenshot: boolean;
  };
}

const WORKER_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];

const DEFAULT_CONFIG: AppConfig = {
  line:  { token: '', userId: '' },
  imgbb: { apiKey: '' },
  workers: [
    { id: 1, name: 'Worker 1', color: '#6366f1' },
    { id: 2, name: 'Worker 2', color: '#10b981' },
  ],
  notify: {
    defaultTemplate:      '🤖 Auto Tester แจ้งเตือน\n👤 {worker}\n🌐 {url}\n📌 {step}\n🕐 {time}',
    queuePassTemplate:    '✅ ผ่านคิวแล้ว!\n👤 {worker}\n🌐 {url}\n⏱ รอไป {elapsed}\n🕐 {time}',
    queueFailTemplate:    '⏱ ยังรอคิวอยู่\n👤 {worker}\n🌐 {url}\n⏱ รอมาแล้ว {elapsed}\n🕐 {time}',
    testCompleteTemplate: '🎉 ทดสอบเสร็จสิ้น\n👤 {worker}\n🌐 {url}\n✅ {pass} | ❌ {fail}\n📊 {passRate}%\n🕐 {time}',
    sendScreenshot: true,
  },
};

const TEMPLATE_VARS = [
  { key: '{worker}',   desc: 'ชื่อ worker' },
  { key: '{url}',      desc: 'URL ปัจจุบัน' },
  { key: '{step}',     desc: 'ชื่อ step' },
  { key: '{time}',     desc: 'เวลา' },
  { key: '{elapsed}',  desc: 'เวลาที่รอ' },
  { key: '{pass}',     desc: 'จำนวน pass' },
  { key: '{fail}',     desc: 'จำนวน fail' },
  { key: '{passRate}', desc: '% pass' },
];

function previewTemplate(v: string) {
  return v
    .replace(/{worker}/g, 'Worker A').replace(/{url}/g, 'https://example.com')
    .replace(/{step}/g, 'Step 3 [Click]').replace(/{time}/g, new Date().toLocaleString('th-TH'))
    .replace(/{elapsed}/g, '2น 15ว').replace(/{pass}/g, '8')
    .replace(/{fail}/g, '1').replace(/{passRate}/g, '88');
}

// ─── Template editor พร้อมแทรกตรง cursor ──────────────────────────────────────
function TemplateEditor({ label, value, onChange, onReset }: {
  label: string; value: string; onChange: (v: string) => void; onReset: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);

  // แทรกตัวแปรตรงตำแหน่ง cursor (ไม่ใช่ต่อท้าย)
  const insertVar = (varKey: string) => {
    const ta = ref.current;
    if (!ta) { onChange(value + varKey); return; }
    const start = ta.selectionStart, end = ta.selectionEnd;
    const next  = value.slice(0, start) + varKey + value.slice(end);
    onChange(next);
    // ตั้ง cursor ไว้หลังตัวแปรที่แทรก
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + varKey.length;
    });
  };

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/50 hover:bg-gray-800 transition-colors">
        <span className="text-sm font-medium text-gray-200">{label}</span>
        <ChevronDown size={15} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}/>
      </button>

      {open && (
        <div className="p-4 space-y-3 bg-gray-900">
          {/* variable pills */}
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mb-1.5">คลิกเพื่อแทรกตัวแปร (ตรงตำแหน่ง cursor)</p>
            <div className="flex flex-wrap gap-1">
              {TEMPLATE_VARS.map(v => (
                <button key={v.key} onClick={() => insertVar(v.key)} title={v.desc}
                  className="text-[10px] font-mono bg-indigo-900/40 hover:bg-indigo-800/60 border border-indigo-700/50 text-indigo-300 px-1.5 py-0.5 rounded transition-colors">
                  {v.key}
                </button>
              ))}
            </div>
          </div>

          <textarea ref={ref} rows={5} value={value} onChange={e => onChange(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-indigo-500 resize-none leading-relaxed"/>

          {/* preview */}
          <div className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">ตัวอย่างที่จะส่งจริง</span>
              <button onClick={onReset} className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-400 transition-colors">
                <RotateCcw size={10}/> reset
              </button>
            </div>
            <pre className="text-xs text-emerald-300/90 whitespace-pre-wrap font-sans leading-relaxed">{previewTemplate(value)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Settings() {
  const [cfg, setCfg]             = useState<AppConfig>(DEFAULT_CONFIG);
  const [showToken, setShowToken] = useState(false);
  const [showImgbb, setShowImgbb] = useState(false);
  const [saved, setSaved]         = useState(false);
  const [dirty, setDirty]         = useState(false);
  const [testing, setTesting]     = useState(false);
  const [testMsg, setTestMsg]     = useState('');
  const [tab, setTab]             = useState<'line'|'workers'|'templates'>('line');

  useEffect(() => {
    try { const raw = localStorage.getItem('atp_config'); if (raw) setCfg({ ...DEFAULT_CONFIG, ...JSON.parse(raw) }); } catch {}
  }, []);

  // เตือนก่อนออกถ้ายังไม่บันทึก
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const update = (fn: (c: AppConfig) => AppConfig) => { setCfg(fn); setDirty(true); setSaved(false); };
  const save = () => { localStorage.setItem('atp_config', JSON.stringify(cfg)); setSaved(true); setDirty(false); setTimeout(() => setSaved(false), 2500); };

  const updateLine   = (k: keyof AppConfig['line'], v: string) => update(c => ({ ...c, line: { ...c.line, [k]: v } }));
  const updateNotify = (k: keyof AppConfig['notify'], v: any)  => update(c => ({ ...c, notify: { ...c.notify, [k]: v } }));
  const resetTpl     = (k: keyof AppConfig['notify'])           => update(c => ({ ...c, notify: { ...c.notify, [k]: DEFAULT_CONFIG.notify[k] } }));
  const updateWorker = (id: number, k: keyof WorkerConfig, v: any) => update(c => ({ ...c, workers: c.workers.map(w => w.id === id ? { ...w, [k]: v } : w) }));
  const addWorker    = () => update(c => { const id = Math.max(0, ...c.workers.map(w => w.id)) + 1; return { ...c, workers: [...c.workers, { id, name: `Worker ${id}`, color: WORKER_COLORS[(id-1) % WORKER_COLORS.length] }] }; });
  const removeWorker = (id: number) => update(c => ({ ...c, workers: c.workers.filter(w => w.id !== id) }));

  const testLine = async () => {
    if (!cfg.line.token || !cfg.line.userId) { setTestMsg('❌ กรอก Token และ User ID ก่อน'); return; }
    setTesting(true); setTestMsg('');
    try {
      const res = await fetch('/api/notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cfg.line.token, userId: cfg.line.userId, message: '✅ ทดสอบ Auto Tester สำเร็จ!\n🕐 ' + new Date().toLocaleString('th-TH') }),
      });
      const data = await res.json();
      setTestMsg(data.success ? '✅ ส่งสำเร็จ เช็ก LINE ได้เลย' : `❌ ${data.error}`);
    } catch (e: any) { setTestMsg(`❌ ${e.message}`); }
    finally { setTesting(false); }
  };

  const TABS = [
    { id: 'line',      label: 'LINE & รูป',      icon: <Bot size={14}/> },
    { id: 'workers',   label: 'Workers',          icon: <Users size={14}/> },
    { id: 'templates', label: 'ข้อความแจ้งเตือน', icon: <Bell size={14}/> },
  ] as const;

  const lineReady  = cfg.line.token && cfg.line.userId;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">

      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"><ArrowLeft size={18}/></Link>
            <div>
              <h1 className="text-base font-bold text-gray-100">Settings</h1>
              <p className="text-[11px] text-gray-600">LINE, Worker และข้อความแจ้งเตือน</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {dirty && <span className="flex items-center gap-1 text-[11px] text-amber-400"><AlertTriangle size={12}/> ยังไม่บันทึก</span>}
            <button onClick={save}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${saved ? 'bg-emerald-700 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
              {saved ? <CheckCircle size={14}/> : <Save size={14}/>}
              {saved ? 'บันทึกแล้ว' : 'บันทึก'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-5">

        {/* Status banner */}
        <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 mb-5 text-xs ${lineReady ? 'bg-emerald-950/30 border border-emerald-900/50 text-emerald-300' : 'bg-amber-950/30 border border-amber-900/50 text-amber-300'}`}>
          {lineReady ? <CheckCircle size={14}/> : <AlertTriangle size={14}/>}
          {lineReady ? 'LINE พร้อมใช้งานแล้ว — การแจ้งเตือนจะทำงานเมื่อรัน test' : 'ยังไม่ได้ตั้งค่า LINE — ฟีเจอร์แจ้งเตือนจะยังไม่ทำงาน'}
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-900 border border-gray-800 p-1 rounded-xl mb-5 gap-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t.id ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ════ Tab: LINE ════ */}
        {tab === 'line' && (
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2"><Bot size={15} className="text-green-400"/><h2 className="font-semibold text-gray-200 text-sm">LINE Bot</h2></div>

              {/* step-by-step guide */}
              <ol className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 text-xs text-gray-400 space-y-2.5 leading-relaxed list-none">
                <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-indigo-900/60 text-indigo-300 flex items-center justify-center text-[10px] font-bold">1</span>
                  <span>เปิด <a href="https://developers.line.biz/console/" target="_blank" rel="noopener" className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-0.5">LINE Developers Console <ExternalLink size={10}/></a> → สร้าง Provider → สร้าง channel แบบ <span className="text-gray-300 font-medium">Messaging API</span></span></li>
                <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-indigo-900/60 text-indigo-300 flex items-center justify-center text-[10px] font-bold">2</span>
                  <span>แท็บ <span className="text-gray-300 font-medium">Messaging API</span> → เลื่อนลงล่าง → กด <span className="text-gray-300 font-medium">Issue</span> ที่ Channel access token → คัดลอกมาวางช่องด้านล่าง</span></li>
                <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-indigo-900/60 text-indigo-300 flex items-center justify-center text-[10px] font-bold">3</span>
                  <span>สแกน QR เพิ่มบอทเป็นเพื่อน → หา <span className="text-gray-300 font-medium">Your user ID</span> ในแท็บ <span className="text-gray-300 font-medium">Basic settings</span> (ขึ้นต้นด้วย U)</span></li>
              </ol>

              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1.5">Channel Access Token</label>
                <div className="flex gap-2">
                  <input type={showToken ? 'text' : 'password'} value={cfg.line.token} onChange={e => updateLine('token', e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiJ9..."
                    className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-indigo-500"/>
                  <button onClick={() => setShowToken(v => !v)} className="p-2 text-gray-500 hover:text-gray-300 bg-gray-800 border border-gray-700 rounded-lg">{showToken ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1.5">User ID</label>
                <input value={cfg.line.userId} onChange={e => updateLine('userId', e.target.value)}
                  placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-indigo-500"/>
                <p className="text-[10px] text-gray-600 mt-1">U = ส่วนตัว · C = กลุ่ม · R = ห้อง</p>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button onClick={testLine} disabled={testing}
                  className="flex items-center gap-2 px-4 py-2 bg-green-800 hover:bg-green-700 disabled:bg-gray-700 text-white rounded-lg text-xs font-semibold transition-colors">
                  {testing ? <RefreshCw size={12} className="animate-spin"/> : <MessageSquare size={12}/>}
                  {testing ? 'กำลังส่ง...' : 'ทดสอบส่ง'}
                </button>
                {testMsg && <span className={`text-xs font-medium ${testMsg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>{testMsg}</span>}
              </div>
            </div>

            {/* imgbb */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2"><ImageIcon size={15} className="text-blue-400"/><h2 className="font-semibold text-gray-200 text-sm">รูป Screenshot (imgbb)</h2></div>
              <p className="text-xs text-gray-500 leading-relaxed">
                ต้องใช้ imgbb เพื่ออัปโหลดรูปก่อนส่งเข้า LINE (LINE ส่งรูปจากเครื่อง local โดยตรงไม่ได้)
                สมัครฟรีที่ <a href="https://api.imgbb.com/" target="_blank" rel="noopener" className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-0.5">api.imgbb.com <ExternalLink size={10}/></a> แล้วคัดลอก API key มาวาง
              </p>
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1.5">imgbb API Key</label>
                <div className="flex gap-2">
                  <input type={showImgbb ? 'text' : 'password'} value={cfg.imgbb.apiKey} onChange={e => update(c => ({ ...c, imgbb: { apiKey: e.target.value } }))}
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-indigo-500"/>
                  <button onClick={() => setShowImgbb(v => !v)} className="p-2 text-gray-500 hover:text-gray-300 bg-gray-800 border border-gray-700 rounded-lg">{showImgbb ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer pt-1">
                <input type="checkbox" checked={cfg.notify.sendScreenshot} onChange={e => updateNotify('sendScreenshot', e.target.checked)} className="w-4 h-4 accent-indigo-500 rounded"/>
                <span className="text-xs text-gray-300">แนบ screenshot อัตโนมัติเมื่อส่ง Notify LINE</span>
              </label>
            </div>
          </div>
        )}

        {/* ════ Tab: Workers ════ */}
        {tab === 'workers' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Users size={15} className="text-indigo-400"/><h2 className="font-semibold text-gray-200 text-sm">ชื่อ Worker</h2></div>
              <button onClick={addWorker} className="flex items-center gap-1.5 text-xs bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"><Plus size={12}/> เพิ่ม</button>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">ชื่อจะแสดงใน Log และข้อความ LINE — worker ลำดับที่ 1 จะใช้กับโหมดสิงจอเดิม (CDP) ด้วย</p>

            <div className="space-y-2">
              {cfg.workers.map((w, idx) => (
                <div key={w.id} className="flex items-center gap-3 bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
                  <span className="text-[10px] text-gray-600 font-mono w-4 shrink-0">{idx+1}</span>
                  <input type="color" value={w.color} onChange={e => updateWorker(w.id, 'color', e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0 shrink-0" title="สี"/>
                  <span className="shrink-0 px-2.5 py-1 rounded-md text-xs font-bold text-white" style={{ backgroundColor: w.color }}>W{w.id}</span>
                  <input value={w.name} onChange={e => updateWorker(w.id, 'name', e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-500 min-w-0" placeholder={`Worker ${w.id}`}/>
                  <button onClick={() => removeWorker(w.id)} disabled={cfg.workers.length <= 1}
                    className="p-1.5 text-gray-600 hover:text-red-400 disabled:opacity-20 rounded-lg transition-colors shrink-0"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>

            <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg px-4 py-3 text-xs space-y-1 mt-2">
              <p className="text-gray-500 font-semibold mb-1">ตัวอย่างใน Log:</p>
              {cfg.workers.slice(0, 3).map(w => (
                <p key={w.id} className="font-mono text-[11px]"><span style={{ color: w.color }}>[{w.name}]</span><span className="text-gray-500"> ✅ Step 3 [Click] → #submit</span></p>
              ))}
            </div>
          </div>
        )}

        {/* ════ Tab: Templates ════ */}
        {tab === 'templates' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 leading-relaxed px-1">แตะที่หัวข้อเพื่อแก้ไข · คลิกตัวแปรเพื่อแทรกตรงตำแหน่งที่พิมพ์ค้างอยู่</p>
            <TemplateEditor label="📲 Notify LINE (ทั่วไป)"          value={cfg.notify.defaultTemplate}      onChange={v => updateNotify('defaultTemplate', v)}      onReset={() => resetTpl('defaultTemplate')}/>
            <TemplateEditor label="✅ ผ่านคิวแล้ว"                    value={cfg.notify.queuePassTemplate}    onChange={v => updateNotify('queuePassTemplate', v)}    onReset={() => resetTpl('queuePassTemplate')}/>
            <TemplateEditor label="⏱ รอคิวนาน (แจ้งทุก 10 นาที)"      value={cfg.notify.queueFailTemplate}    onChange={v => updateNotify('queueFailTemplate', v)}    onReset={() => resetTpl('queueFailTemplate')}/>
            <TemplateEditor label="🎉 ทดสอบเสร็จสิ้น (สรุปท้าย run)"   value={cfg.notify.testCompleteTemplate} onChange={v => updateNotify('testCompleteTemplate', v)} onReset={() => resetTpl('testCompleteTemplate')}/>
          </div>
        )}
      </div>
    </div>
  );
}
