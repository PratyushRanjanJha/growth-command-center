import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer, ScatterChart, Scatter, ZAxis, Cell, ReferenceLine, LabelList } from 'recharts';
import { FileJson, FileSpreadsheet, PanelRightClose, PanelRightOpen, MessageSquareText, X, Check, Send, RotateCcw, Plus, TriangleAlert, TrendingDown, CircleDollarSign, Trash2, Database, FlaskConical, Copy, CircleCheck } from 'lucide-react';
import { HIST } from './histData.js';
import { compute, seedSimulation, seedTasks, BETS, betById, INDICATOR_FIELDS, CORE_FIELDS, OWNERS, TASK_STATUSES, THRESHOLDS, ALERT_RULES, SCENARIOS, CAP_DAY, evalStatus, div, fmt, inr, pct, inrK, toCSV, simToday } from './model.js';
import { STARTERS, buildContext, systemPrompt, parseReply, callAnthropic, callBuiltIn, deterministic } from './copilot.js';

const LS_KEY = 'gcc-attendee-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; } };
const save = (v) => { try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch { /* storage unavailable */ } };
const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---- Design tokens ----
const C = { ink: '#18181B', mute: '#71717A', line: '#E4E4E7', faint: '#F4F4F5', brand: '#1D4ED8', zinc300: '#D4D4D8', zinc400: '#A1A1AA' };
const BADGE = {
  SCALE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  MONITOR: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  CHANGE: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  STOP: 'bg-rose-50 text-rose-700 ring-rose-600/20',
};
const DOT = { SCALE: '#047857', MONITOR: '#B45309', CHANGE: '#C2410C', STOP: '#BE123C' };
const TXT = { SCALE: 'text-emerald-700', MONITOR: 'text-amber-700', CHANGE: 'text-orange-700', STOP: 'text-rose-700' };
const I = { size: 16, strokeWidth: 1.75 };

const Badge = ({ s }) => <span className={`inline-flex items-center rounded px-1.5 h-5 text-[10.5px] font-semibold tracking-wider ring-1 ring-inset ${BADGE[s]}`}>{s}</span>;
const Id = ({ children }) => <span className="font-mono text-[11.5px] text-mute">{children}</span>;
const Btn = ({ kind = 'secondary', className = '', children, ...p }) => (
  <button {...p} className={`inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-md text-[13px] font-medium whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${kind === 'primary' ? 'bg-brand text-white hover:bg-[#1E40AF]' : kind === 'ghost' ? 'text-mute hover:text-ink hover:bg-faint' : 'bg-card text-ink border border-line hover:bg-faint'} ${className}`}>{children}</button>
);
const Card = ({ className = '', children }) => <div className={`bg-card border border-line rounded-md ${className}`}>{children}</div>;
const CardHead = ({ title, hint, right }) => (
  <div className="flex items-start justify-between gap-3 mb-3">
    <div><div className="text-[13px] font-semibold text-ink">{title}</div>{hint && <div className="text-[12px] text-mute">{hint}</div>}</div>
    {right}
  </div>
);
const Th = ({ children, right, className = '' }) => <th className={`label !text-[10.5px] py-2 px-3 font-medium border-b border-line bg-faint/60 ${right ? 'text-right' : 'text-left'} ${className}`}>{children}</th>;

function useClaude(name) {
  const [ns, setNs] = useState(null);
  useEffect(() => {
    let live = true;
    try { if (window.claude && typeof window.claude.use === 'function') window.claude.use(name).then((x) => live && setNs(() => x)).catch(() => {}); } catch { /* not hosted */ }
    return () => { live = false; };
  }, [name]);
  return ns;
}

function Md({ text }) {
  const inline = (s, k) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={k + '-' + i} className="font-semibold">{p.slice(2, -2)}</strong> : <React.Fragment key={k + '-' + i}>{p}</React.Fragment>));
  return <div className="space-y-1 num-wrap" style={{ fontVariantNumeric: 'tabular-nums' }}>{text.split('\n').filter((l) => l.trim()).map((l, i) => {
    const t = l.trim();
    if (/^[-*•]\s/.test(t)) return <div key={i} className="pl-3 relative"><span className="absolute left-0 text-zinc-400">–</span>{inline(t.replace(/^[-*•]\s/, ''), i)}</div>;
    if (t.startsWith('→')) return <div key={i} className="pl-6 text-mute">{inline(t, i)}</div>;
    if (/^#+\s/.test(t)) return <div key={i} className="font-semibold">{inline(t.replace(/^#+\s/, ''), i)}</div>;
    return <div key={i}>{inline(t, i)}</div>;
  })}</div>;
}

function Num({ value, onChange, step = 1, disabled, w = 'w-24' }) {
  return <input type="number" step={step} disabled={disabled} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} className={`${w} px-2 text-right num`} />;
}

function Kpi({ label, value, sub, bar, tone }) {
  return (
    <div className="bg-card p-4">
      <div className="label">{label}</div>
      <div className={`mt-1 text-[24px] leading-7 font-semibold tracking-tight num whitespace-nowrap ${tone || 'text-ink'}`}>{value}</div>
      {bar != null && <div className="h-1 bg-faint mt-2 rounded-sm overflow-hidden"><div className="h-1" style={{ width: Math.min(100, bar * 100) + '%', background: bar > 0.9 ? DOT.STOP : C.brand }} /></div>}
      <div className="text-[12px] text-mute mt-1.5 num-wrap" style={{ fontVariantNumeric: 'tabular-nums' }}>{sub}</div>
    </div>
  );
}

const Section = ({ id, title, note, children, right, icon: Icon }) => (
  <section id={id} className="scroll-mt-28">
    <div className="flex flex-wrap items-end justify-between gap-2 mb-2.5">
      <div>
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink">{Icon && <Icon {...I} className="text-mute" />}{title}</h2>
        {note && <p className="text-[12px] text-mute mt-0.5">{note}</p>}
      </div>
      {right}
    </div>
    {children}
  </section>
);

function ChartTip({ active, payload, label, scatter }) {
  if (!active || !payload?.length) return null;
  if (scatter) {
    const d = payload[0].payload;
    return (
      <div className="bg-card border border-line rounded-md px-2.5 py-2 text-[12px] num">
        <div className="font-medium text-ink mb-0.5">{d.name}</div>
        <div className="text-mute">CAC <span className="text-ink">₹{fmt(d.y)}</span> · reg→attend <span className="text-ink">{d.x}%</span></div>
        <div className="text-mute">{fmt(d.z)} attendees · <span className={TXT[d.status]}>{d.status}</span></div>
      </div>
    );
  }
  return (
    <div className="bg-card border border-line rounded-md px-2.5 py-2 text-[12px] num min-w-[150px]">
      <div className="font-medium text-ink mb-1">{label}</div>
      {payload.map((p) => <div key={p.dataKey} className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5 text-mute"><span className="w-2 h-2 inline-block" style={{ background: p.color }} />{p.name}</span><span className="text-ink">{fmt(p.value)}</span></div>)}
    </div>
  );
}

export default function App() {
  const saved = useMemo(load, []);
  const [mode, setMode] = useState(saved?.mode || 'hist');
  const [sim, setSim] = useState(saved?.sim || seedSimulation());
  const [tasks, setTasks] = useState(saved?.tasks || seedTasks());
  const [chat, setChat] = useState(saved?.chat || []);
  const [provider, setProvider] = useState(saved?.provider || 'auto');
  const [model, setModel] = useState(saved?.model || 'claude-sonnet-5-5');
  const [apiKey, setApiKey] = useState('');
  const [open, setOpen] = useState(() => { try { return window.innerWidth >= 1280; } catch { return true; } });
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [toast, setToast] = useState('');
  const [exportText, setExportText] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [taskFilter, setTaskFilter] = useState('All');
  const [newTask, setNewTask] = useState({ task: '', campaign: 'B1', owner: 'Arjun Verma', deadline: '', status: 'To do', budget: 0 });
  const sample = useClaude('sample');
  const downloads = useClaude('downloads');
  const chatEnd = useRef(null);

  useEffect(() => { save({ mode, sim, tasks, chat: chat.slice(-40), provider, model }); }, [mode, sim, tasks, chat, provider, model]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'end' }); }, [chat, busy]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3200); return () => clearTimeout(t); }, [toast]);

  const view = useMemo(() => compute(mode, sim, tasks), [mode, sim, tasks]);
  const T = view.tot, tgt = view.target, isHist = view.isHist;
  const tag = isHist ? '[DATA]' : '[SIMULATION]';

  const setCamp = (id, k, v) => setSim((s) => ({ ...s, campaigns: { ...s.campaigns, [id]: { ...s.campaigns[id], [k]: v } } }));
  const setG = (k, v) => setSim((s) => ({ ...s, [k]: v }));
  const updTask = (id, k, v) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, [k]: v } : t)));

  // ---- Export ----
  async function exportFile(filename, data) {
    if (downloads) {
      try { await downloads.save({ filename, data }); setToast(`Saved ${filename}`); return; } catch (e) { if (e?.code === 'declined') { setToast('Download declined'); return; } }
    }
    let framed = true;
    try { framed = window.self !== window.top; } catch { framed = true; }
    if (!framed) {
      try {
        const url = URL.createObjectURL(new Blob([data], { type: filename.endsWith('.csv') ? 'text/csv' : 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setToast(`Downloaded ${filename}`); return;
      } catch { /* fall through to copy dialog */ }
    }
    setExportText({ filename, data });
  }
  const exportJSON = () => exportFile('growth-command-center.json', JSON.stringify({ exportedAt: new Date().toISOString(), mode, settings: { scenario: sim.scenario, weeksOut: sim.weeksOut }, simulation: sim, tasks, computed: buildContext(view, tasks) }, null, 2));
  const exportCSV = () => exportFile(`growth-command-center-${isHist ? 'historical' : 'simulation'}.csv`, toCSV(view, tasks));

  // ---- Copilot ----
  const effProvider = provider === 'auto' ? (apiKey ? 'api' : sample ? 'builtin' : 'rules') : provider;
  async function ask(q) {
    const question = q.trim();
    if (!question || busy) return;
    const userMsg = { role: 'user', content: question, id: uid() };
    const hist = [...chat, userMsg];
    setChat(hist); setInput(''); setBusy(true);
    const ctx = buildContext(view, tasks);
    let out, via, note = '';
    try {
      if (effProvider === 'api' && apiKey) {
        const txt = await callAnthropic({ apiKey, model, system: systemPrompt(ctx), history: hist.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-10).map((m) => ({ role: m.role, content: m.content })) });
        out = parseReply(txt); via = `Anthropic API · ${model}`;
      } else if (effProvider === 'builtin' && sample) {
        const txt = await callBuiltIn({ sample, system: systemPrompt(ctx), history: hist.slice(-10).map((m) => ({ role: m.role, content: m.content })) });
        out = parseReply(txt); via = 'Claude (built-in)';
      } else {
        out = deterministic(question, view, tasks); via = 'Deterministic engine';
      }
    } catch (e) {
      out = deterministic(question, view, tasks); via = 'Deterministic engine (fallback)';
      note = `LLM call failed: ${String(e?.message || e).slice(0, 140)}. Hosted pages block direct API calls — run locally for API-key mode.`;
    }
    setChat((c) => [...c, { role: 'assistant', content: out.text, proposals: out.proposals.map((p) => ({ ...p, pid: uid(), state: 'pending' })), via, note, id: uid() }]);
    setBusy(false);
  }

  function approve(msgId, pid) {
    const msg = chat.find((m) => m.id === msgId); const p = msg?.proposals.find((x) => x.pid === pid);
    if (!p || p.state !== 'pending') return;
    let applied = '';
    if (p.budgetMove && !isHist) {
      const { from, to, amount } = p.budgetMove;
      const avail = Math.max(0, (Number(sim.campaigns[from]?.budget) || 0) - (Number(sim.campaigns[from]?.spend) || 0));
      const amt = Math.min(amount, avail);
      if (amt > 0) {
        setSim((s) => ({ ...s, campaigns: { ...s.campaigns, [from]: { ...s.campaigns[from], budget: (Number(s.campaigns[from].budget) || 0) - amt }, [to]: { ...s.campaigns[to], budget: (Number(s.campaigns[to].budget) || 0) + amt } } }));
        applied = ` · budget moved ${inr(amt)} ${from}→${to}`;
      }
    }
    setTasks((ts) => [...ts, { id: uid(), task: p.task, campaign: p.campaign, owner: p.owner, deadline: p.deadline, status: 'To do', budget: p.budget || 0, source: 'Copilot' }]);
    setChat((c) => c.map((m) => (m.id === msgId ? { ...m, proposals: m.proposals.map((x) => (x.pid === pid ? { ...x, state: 'added', applied } : x)) } : m)));
    setToast('Task added to Task Manager' + applied);
  }
  const dismiss = (msgId, pid) => setChat((c) => c.map((m) => (m.id === msgId ? { ...m, proposals: m.proposals.map((x) => (x.pid === pid ? { ...x, state: 'dismissed' } : x)) } : m)));

  // ---- Chart data ----
  const funnelData = view.funnel.map((r) => ({ ...r, Target: r.Target > 0 ? r.Target : null, Actual: r.Actual > 0 ? r.Actual : null, Baseline: r.Baseline > 0 ? r.Baseline : null }));
  const scatterData = isHist
    ? HIST.channels.map((c) => { const m = { spend: c.spend, attendees: c.attendees, regs: c.regs }; const cac = div(c.spend, c.attendees), r = div(c.attendees, c.regs); return { name: c.name, x: +(r * 100).toFixed(1), y: Math.round(cac), z: c.attendees, status: evalStatus('X', { ...m, cac, regToAtt: r }, 0).status }; })
    : view.campaigns.filter((c) => !c.overlay && c.cac != null && c.regToAtt != null).map((c) => ({ name: `${c.id} ${c.short}`, x: +(c.regToAtt * 100).toFixed(1), y: Math.round(c.cac), z: c.attendees, status: c.status }));

  const headline = `${fmt(T.total)} verified attendees — ${pct(T.total / tgt.total, 0)} of the ${isHist ? '2025 revised goal' : SCENARIOS[sim.scenario].label.toLowerCase() + ' target'}`;
  const filteredTasks = tasks.filter((t) => taskFilter === 'All' || t.status === taskFilter || t.campaign === taskFilter);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Top bar */}
      <header className="md:sticky top-0 z-30 bg-card border-b border-line">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 md:px-6 min-h-[52px] py-2">
          <div className="flex items-center gap-2.5 mr-auto">
            <div className="w-6 h-6 rounded-md bg-brand-ink text-white grid place-items-center font-mono text-[10px] font-medium">GC</div>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold">Growth Command Center</div>
              <div className="text-[11.5px] text-mute">Challenge A · Attendee growth · Delhi NCR</div>
            </div>
          </div>
          <div role="tablist" className="inline-flex p-0.5 bg-faint border border-line rounded-md text-[12.5px]">
            {[['hist', 'Historical Baseline Data', Database], ['sim', 'Active Campaign Simulation', FlaskConical]].map(([k, l, Ic]) => (
              <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[5px] font-medium ${mode === k ? 'bg-card text-ink border border-line' : 'text-mute hover:text-ink border border-transparent'}`}><Ic size={14} strokeWidth={1.75} />{l}</button>
            ))}
          </div>
          {!isHist && (
            <div className="flex items-center gap-2 text-[12.5px]">
              <select value={sim.scenario} onChange={(e) => setG('scenario', e.target.value)} className="px-2" aria-label="Target scenario">
                <option value="base">Base · 3,000 · ₹3.0L</option><option value="stretch">Stretch · 5,000 · ₹5.0L</option>
              </select>
              <label className="flex items-center gap-1 text-mute font-mono text-[12px]">T−<Num value={sim.weeksOut} onChange={(v) => setG('weeksOut', Math.max(0, Math.min(12, v || 0)))} w="w-12" />w</label>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Btn onClick={exportJSON} title="Export full state as JSON"><FileJson {...I} />JSON</Btn>
            <Btn onClick={exportCSV} title="Export campaigns and tasks as CSV"><FileSpreadsheet {...I} />CSV</Btn>
            <Btn kind={open ? 'secondary' : 'primary'} onClick={() => setOpen((o) => !o)} aria-label={open ? 'Hide Copilot' : 'Open Copilot'}>{open ? <PanelRightClose {...I} /> : <PanelRightOpen {...I} />}Copilot</Btn>
          </div>
        </div>
        <nav className="flex items-center gap-1 px-4 md:px-6 h-9 border-t border-line text-[12.5px] overflow-x-auto whitespace-nowrap [&>*]:flex-none">
          <a href="#dashboard" className="px-2 py-1 rounded-md text-mute hover:text-ink hover:bg-faint">Funnel &amp; KPIs</a>
          <a href="#diagnostics" className="px-2 py-1 rounded-md text-mute hover:text-ink hover:bg-faint">Diagnostics</a>
          <a href="#execution" className="px-2 py-1 rounded-md text-mute hover:text-ink hover:bg-faint">Execution</a>
          <span className="ml-auto pl-4 text-[11.5px] text-mute font-mono">{isHist ? 'campusfest_2025 · deduplicated · read-only' : `sim_date ${simToday(sim.weeksOut)} · event 2027-02-13/14 · editable`}</span>
        </nav>
      </header>

      <div className={open ? 'xl:grid xl:grid-cols-[minmax(0,1fr)_380px]' : ''}>
        <main className="px-4 md:px-6 py-5 space-y-6">
          {/* 1. Dashboard */}
          <Section id="dashboard" title={headline} note={isHist ? `[DATA] ${HIST.dedup.marketingRows} duplicate marketing rows and ${HIST.dedup.checkins} duplicate check-ins removed. Attendance = external, admitted + verified (${HIST.checkinMix.denied} denied, ${HIST.checkinMix.pending} pending excluded).` : '[SIMULATION] Team-entered live values. Attendees = verified or projected from confirmations. Targets are Part 1 [ASSUMPTION].'}>
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-px bg-line border border-line rounded-md overflow-hidden">
              <Kpi label="Total reach" value={fmt(T.reach)} sub={tgt.reach ? `Target ${fmt(tgt.reach)}` : 'Platform-reported, not unique'} />
              <Kpi label="Registrations" value={fmt(T.regs)} sub={`Target ${fmt(tgt.regs)} · ${pct(T.regs / tgt.regs, 0)}`} />
              <Kpi label="Actual attendees" value={fmt(T.total)} tone={T.total < tgt.total * 0.95 ? 'text-rose-700' : ''} sub={`${fmt(T.attendedReg)} reg. + ${fmt(T.walkIns)} walk-in · target ${fmt(tgt.total)}`} />
              <Kpi label="Reg → attend" value={pct(T.regToAtt)} sub={isHist ? 'Confirmed → attended 77.0%' : `2025 68.8% · plan ${pct(tgt.attendedReg / tgt.regs)}`} />
              <Kpi label="Blended CAC" value={inr(T.cac)} sub={isHist ? 'Spend ÷ unique attendees' : 'Plan ₹100 · 2025 ₹134'} />
              <Kpi label="Budget vs cap" value={inrK(T.spend)} bar={T.spend / T.cap} sub={`${pct(T.spend / T.cap, 0)} of ${inrK(T.cap)}${!isHist ? ` · alloc. ${inrK(T.budget)}` : ''}`} />
              <Kpi label="Venue capacity" value={pct(T.capUtil, 0)} bar={T.capUtil} sub={`Day 1 ${fmt(T.day1)} / ${fmt(CAP_DAY)} [ASSUMPTION]`} />
            </div>

            <div className="grid grid-cols-12 gap-3 mt-3">
              <Card className="col-span-12 lg:col-span-7 p-4">
                <CardHead title="End-to-end funnel" hint="Target vs actual vs 2025 baseline · log scale" />
                <div className="h-[280px]">
                  <ResponsiveContainer>
                    <BarChart data={funnelData} margin={{ top: 18, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%" barGap={2}>
                      <CartesianGrid vertical={false} stroke={C.faint} strokeDasharray="3 3" />
                      <XAxis dataKey="stage" tick={{ fontSize: 11 }} interval={0} tickLine={false} axisLine={{ stroke: C.line }} />
                      <YAxis scale="log" domain={[100, 'auto']} allowDataOverflow tickFormatter={(v) => (v >= 1000 ? v / 1000 + 'K' : v)} tick={{ fontSize: 11 }} width={40} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTip />} cursor={{ fill: C.faint }} />
                      <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11.5 }} formatter={(v) => <span style={{ color: C.mute }}>{v}</span>} />
                      <Bar dataKey="Target" fill={C.line} stroke={C.zinc400} strokeWidth={1} radius={0} isAnimationActive={false} />
                      <Bar dataKey="Actual" fill={C.brand} radius={0} isAnimationActive={false}><LabelList dataKey="Actual" position="top" formatter={(v) => (v ? (v >= 10000 ? Math.round(v / 1000) + 'K' : fmt(v)) : '')} style={{ fontSize: 10.5, fill: C.ink, fontVariantNumeric: 'tabular-nums' }} /></Bar>
                      <Bar dataKey="Baseline" name="2025 baseline" fill={C.zinc400} radius={0} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="col-span-12 lg:col-span-5 p-4">
                <CardHead title={`CAC vs reg → attend, by ${isHist ? 'dataset channel' : 'campaign'}`} hint="Bubble size = attendees · colour = status" />
                <div className="h-[280px]">
                  <ResponsiveContainer>
                    <ScatterChart margin={{ top: 8, right: 14, left: 0, bottom: 14 }}>
                      <CartesianGrid stroke={C.faint} strokeDasharray="3 3" />
                      <XAxis type="number" dataKey="x" name="Reg→attend" unit="%" domain={[40, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: C.line }} label={{ value: 'Reg → attend %', position: 'insideBottom', offset: -6, fontSize: 11, fill: C.mute }} />
                      <YAxis type="number" dataKey="y" name="CAC" unit="₹" tick={{ fontSize: 11 }} width={46} tickLine={false} axisLine={false} />
                      <ZAxis type="number" dataKey="z" range={[50, 420]} name="Attendees" />
                      <ReferenceLine y={150} stroke={DOT.CHANGE} strokeWidth={1} strokeDasharray="4 3" label={{ value: 'CHANGE ₹150', fontSize: 10, fill: DOT.CHANGE, position: 'insideTopRight' }} />
                      <ReferenceLine y={180} stroke={DOT.STOP} strokeWidth={1} strokeDasharray="4 3" label={{ value: 'STOP ₹180', fontSize: 10, fill: DOT.STOP, position: 'insideTopRight' }} />
                      <ReferenceLine x={75} stroke={DOT.SCALE} strokeWidth={1} strokeDasharray="4 3" />
                      <Tooltip cursor={{ stroke: C.zinc300, strokeDasharray: '3 3' }} content={<ChartTip scatter />} />
                      <Scatter data={scatterData} isAnimationActive={false}>
                        {scatterData.map((d) => <Cell key={d.name} fill={DOT[d.status]} fillOpacity={0.18} stroke={DOT[d.status]} strokeWidth={2} />)}
                        <LabelList dataKey="name" position="right" style={{ fontSize: 10, fill: C.mute, fillOpacity: 1, stroke: 'none', fontWeight: 400 }} formatter={(v) => String(v).split(' ').slice(0, 2).join(' ')} />
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {isHist && (
                <Card className="col-span-12 overflow-hidden">
                  <div className="px-4 pt-4"><CardHead title="Dataset channel baseline" hint="7 campaigns · exact values from Attendee_Dataset.xlsx" /></div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12.5px] num">
                      <thead><tr>{['Channel', 'Spend', 'Reach', 'CTR', 'Identified', 'Regs', 'Confirmed', 'Attended', 'Id→Reg', 'Reg→Att', 'CAC', 'Opt-out'].map((h, i) => <Th key={h} right={i > 0}>{h}</Th>)}</tr></thead>
                      <tbody>{HIST.channels.map((c) => (
                        <tr key={c.id} className="border-b border-line hover:bg-faint/60">
                          <td className="py-2 px-3"><Id>{c.id}</Id> <span className="ml-1">{c.name}</span></td><td className="text-right px-3">{inr(c.spend)}</td><td className="text-right px-3">{fmt(c.reach)}</td><td className="text-right px-3">{pct(c.clicks / c.impressions)}</td>
                          <td className="text-right px-3">{fmt(c.identified)}</td><td className="text-right px-3">{fmt(c.regs)}</td><td className="text-right px-3">{fmt(c.confirmed)}</td><td className="text-right px-3">{fmt(c.attendees)}</td>
                          <td className="text-right px-3">{pct(c.regs / c.identified)}</td><td className={`text-right px-3 ${c.attendees / c.regs < 0.55 ? 'text-rose-700 font-medium' : ''}`}>{pct(c.attendees / c.regs)}</td>
                          <td className={`text-right px-3 ${c.spend / c.attendees > 180 ? 'text-rose-700 font-medium' : ''}`}>{inr(c.spend / c.attendees)}</td><td className={`text-right px-3 ${c.optOuts / c.identified > 0.08 ? 'text-rose-700 font-medium' : ''}`}>{pct(c.optOuts / c.identified)}</td>
                        </tr>))}
                        <tr className="font-semibold bg-faint/40"><td className="py-2 px-3">Total + {HIST.walkIns} walk-ins</td><td className="text-right px-3">{inr(T.spend)}</td><td className="text-right px-3">{fmt(T.reach)}</td><td className="text-right px-3">{pct(HIST.channels.reduce((a, c) => a + c.clicks, 0) / HIST.channels.reduce((a, c) => a + c.impressions, 0))}</td><td className="text-right px-3">{fmt(T.identified)}</td><td className="text-right px-3">{fmt(T.regs)}</td><td className="text-right px-3">{fmt(T.confirmed)}</td><td className="text-right px-3">{fmt(T.total)}</td><td className="text-right px-3">{pct(T.regs / T.identified)}</td><td className="text-right px-3">{pct(T.regToAtt)}</td><td className="text-right px-3">{inr(T.cac)}</td><td className="text-right px-3">{pct(HIST.channels.reduce((a, c) => a + c.optOuts, 0) / HIST.channels.reduce((a, c) => a + c.identified, 0))}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[12px] text-mute px-4 py-3 num">[DATA] Day 1 {fmt(HIST.day1)} · Day 2 {fmt(HIST.day2)} · both days {fmt(HIST.bothDays)}. Non-confirmed registrants (183 cancelled, 88 waitlisted, 29 interested) had 0 attendance.</p>
                </Card>
              )}
            </div>
          </Section>

          {/* 2. Diagnostics */}
          <Section id="diagnostics" title="Campaign & experiment diagnostics" note={`Status = worst of (Part 1 leading-indicator threshold, CAC guardrail). ${isHist ? 'Historical mode maps each bet to its 2025 proxy channel(s).' : 'Edits under Execution re-score instantly.'}`}>
            <div className="grid grid-cols-12 gap-3 mb-3">
              <Card className="col-span-12 md:col-span-4 p-4">
                <div className="label flex items-center gap-1.5"><TrendingDown size={14} strokeWidth={1.75} />Steepest drop-off · {view.steepest.basis}</div>
                <div className="mt-1.5 text-[17px] font-semibold tracking-tight">{view.steepest.step}</div>
                <div className="text-[12.5px] num mt-0.5"><span className="text-ink font-medium">{pct(view.steepest.conv)}</span> <span className="text-mute">conversion · {fmt(view.steepest.lost)} lost{view.steepest.tgt ? ` · plan ${pct(view.steepest.tgt)}` : ''} {tag}</span></div>
                <div className="text-[11.5px] text-mute mt-2 font-mono">{view.steps.filter((s) => s !== view.steepest).map((s) => `${s.step} ${pct(s.conv)}`).join(' · ')}</div>
              </Card>
              <Card className="col-span-12 md:col-span-4 p-4">
                <div className="label flex items-center gap-1.5"><CircleDollarSign size={14} strokeWidth={1.75} />Highest-CAC channel</div>
                <div className="mt-1.5 text-[17px] font-semibold tracking-tight">{view.highestCAC?.name}</div>
                <div className="text-[12.5px] num mt-0.5"><span className="text-rose-700 font-medium">{inr(view.highestCAC?.cac)}</span> <span className="text-mute">per attendee vs blended {inr(T.cac)} · {(view.highestCAC.cac / T.cac).toFixed(1)}× {tag}</span></div>
                <div className="text-[11.5px] text-mute mt-2 font-mono">reg→attend {pct(view.highestCAC?.regToAtt)}{view.highestCAC?.optOutPct != null ? ` · opt-out ${view.highestCAC.optOutPct.toFixed(1)}%` : ''}</div>
              </Card>
              <Card className="col-span-12 md:col-span-4 p-4">
                <div className="label flex items-center gap-1.5"><TriangleAlert size={14} strokeWidth={1.75} />Copilot alert rules · {view.alerts.length} firing</div>
                <ul className="text-[12px] space-y-1.5 mt-2 max-h-[112px] overflow-y-auto pr-1 num">
                  {view.alerts.length ? view.alerts.map((a, i) => <li key={i} className="flex gap-2"><span className={`font-mono text-[11px] font-medium mt-px ${a.severity === 'high' ? 'text-rose-700' : 'text-amber-700'}`}>{a.rule}</span><span className="text-ink">{a.text}</span></li>) : <li className="flex items-center gap-1.5 text-emerald-700"><CircleCheck size={14} strokeWidth={1.75} />All clear</li>}
                </ul>
              </Card>
            </div>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] num">
                  <thead><tr>{['#', 'Campaign', 'Spend', 'Reach', 'Regs', 'Attendees', 'CAC', 'Reg→Att', 'Status', 'Threshold evidence', 'Tasks'].map((h, i) => <Th key={h} right={[2, 3, 4, 5, 6, 7, 10].includes(i)}>{h}</Th>)}</tr></thead>
                  <tbody>{view.campaigns.map((c) => (
                    <tr key={c.id} className="border-b border-line last:border-0 align-top hover:bg-faint/60">
                      <td className="py-2.5 px-3 text-mute">{c.rank ?? '—'}</td>
                      <td className="py-2.5 px-3 min-w-[200px]"><div className="font-medium text-ink"><Id>{c.id}</Id> <span className="ml-1">{c.name}</span></div><div className="text-[11.5px] text-mute mt-0.5">{c.owner} · {c.decision}{isHist && c.sources ? ` · 2025 proxy: ${c.sources}` : ''}{c.overlay ? ' · overlay: attendees = incremental vs control' : ''}</div>{c.rice != null && <div className="font-mono text-[11px] text-mute mt-1">RICE <span className="text-ink">{fmt(c.rice)}</span> = {c.riceIn} · {c.timeline} · test: {c.test}</div>}</td>
                      <td className="py-2.5 text-right px-3">{inr(c.spend)}</td><td className="py-2.5 text-right px-3">{fmt(c.reach)}</td><td className="py-2.5 text-right px-3">{c.overlay ? '—' : fmt(c.regs)}</td>
                      <td className="py-2.5 text-right px-3">{fmt(c.attendees)}</td><td className="py-2.5 text-right px-3">{inr(c.cac)}</td><td className="py-2.5 text-right px-3">{c.overlay ? '—' : pct(c.regToAtt)}</td>
                      <td className="py-2.5 px-3"><Badge s={c.status} /></td>
                      <td className="py-2.5 px-3 min-w-[300px] space-y-0.5">{c.reasons.map((r, i) => <div key={i} className="font-mono text-[11px] leading-4"><span className={`font-medium ${TXT[r.verdict]}`}>{r.verdict}</span> <span className="text-ink">{r.rule}</span> <span className="text-mute">· {r.detail}</span></div>)}<div className="text-[11px] text-mute">Basis: {c.basis}</div>{(c.status === 'STOP' || c.status === 'CHANGE') && THRESHOLDS[c.id]?.pivot && <div className="text-[11px] mt-0.5"><span className="font-medium text-ink">Pivot:</span> <span className="text-mute">{THRESHOLDS[c.id].pivot}</span></div>}</td>
                      <td className="py-2.5 text-right px-3 text-mute">{c.openTasks}/{c.taskCount}</td>
                    </tr>))}
                  </tbody>
                </table>
              </div>
              <details className="border-t border-line text-[12px]">
                <summary className="cursor-pointer px-4 py-2.5 text-mute hover:text-ink select-none">Part 1 thresholds &amp; alert rules</summary>
                <div className="overflow-x-auto px-4 pb-3">
                  <table className="w-full font-mono text-[11px]"><tbody>{Object.entries(THRESHOLDS).map(([k, t]) => <tr key={k} className="border-b border-line align-top"><td className="pr-3 py-1.5 font-medium text-ink">{k}</td><td className="pr-3 py-1.5 text-emerald-700">scale: {t.scale}</td><td className="pr-3 py-1.5 text-orange-700">change: {t.change}</td><td className="pr-3 py-1.5 text-rose-700">stop: {t.stop}</td><td className="py-1.5 text-mute">kpi: {t.kpi}{t.pivot ? <><br />pivot: {t.pivot}</> : null}</td></tr>)}
                    {ALERT_RULES.map((r) => <tr key={r.id} className="border-b border-line last:border-0"><td className="pr-3 py-1.5 font-medium">{r.id}</td><td colSpan={4} className="py-1.5 text-ink">{r.name}: {r.rule}</td></tr>)}</tbody></table>
                </div>
              </details>
            </Card>
          </Section>

          {/* 3. Execution */}
          <Section id="execution" title="Execution" note="Campaign editor and task manager. Every edit recalculates KPIs, charts, statuses and Copilot context." right={!isHist && (confirmReset
            ? <span className="flex gap-1.5 items-center text-[12px] text-mute">Reset simulation and tasks?<Btn kind="primary" className="!bg-rose-700 hover:!bg-rose-800" onClick={() => { setSim(seedSimulation()); setTasks(seedTasks()); setConfirmReset(false); setToast('Simulation reset to Part 1 seed'); }}>Reset</Btn><Btn onClick={() => setConfirmReset(false)}>Cancel</Btn></span>
            : <Btn onClick={() => setConfirmReset(true)}><RotateCcw {...I} />Reset to seed</Btn>)}>
            {isHist ? (
              <Card className="p-4 mb-3 flex flex-wrap items-center justify-between gap-3 text-[12.5px]"><span className="text-mute">The historical baseline is the exact dataset and is read-only.</span><Btn kind="primary" onClick={() => setMode('sim')}><FlaskConical {...I} />Edit in simulation</Btn></Card>
            ) : (
              <Card className="overflow-hidden mb-3">
                <div className="px-4 pt-4"><CardHead title="Campaign editor" hint="Budgets, funnel counts and leading indicators" /></div>
                <div className="overflow-x-auto">
                  <table className="text-[12.5px] w-full">
                    <thead><tr><Th>Campaign</Th>{CORE_FIELDS.map(([k, l]) => <Th key={k} right>{l}</Th>)}<Th>Leading indicators</Th><Th>Status</Th></tr></thead>
                    <tbody>{BETS.map((b) => { const c = sim.campaigns[b.id]; const v = view.campaigns.find((x) => x.id === b.id); return (
                      <tr key={b.id} className="border-b border-line align-middle">
                        <td className="py-2 px-3 whitespace-nowrap"><Id>{b.id}</Id> <span className="ml-1 font-medium">{b.short}</span></td>
                        {CORE_FIELDS.map(([k]) => <td key={k} className="px-1.5 py-2"><Num value={c[k]} onChange={(x) => setCamp(b.id, k, x)} w={k === 'reach' ? 'w-24' : 'w-[5.4rem]'} disabled={b.overlay && ['identified', 'regs', 'confirmed'].includes(k)} /></td>)}
                        <td className="px-3 py-2 min-w-[340px]"><div className="flex flex-wrap gap-x-3 gap-y-1.5">{INDICATOR_FIELDS[b.id].map(([k, l]) => <label key={k} className="flex items-center gap-1.5 text-[11.5px] text-mute whitespace-nowrap">{l}<Num value={c[k]} step={k === 'k' ? 0.01 : 0.1} onChange={(x) => setCamp(b.id, k, x)} w="w-16" /></label>)}{b.id === 'B5' && <span className="text-[11px] text-mute self-center font-mono num">cpr {inr(v.cpr)} · confirm {pct(v.confRate, 0)}</span>}{!INDICATOR_FIELDS[b.id].length && <span className="text-[11.5px] text-mute">—</span>}</div></td>
                        <td className="px-3 py-2"><Badge s={v.status} /></td>
                      </tr>); })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 bg-faint/50 text-[12px] text-mute num">
                  <span className="label">Event-level</span>
                  <label className="flex items-center gap-1.5">Walk-ins <Num value={sim.walkIns} onChange={(x) => setG('walkIns', x)} w="w-20" /></label>
                  <label className="flex items-center gap-1.5">Waitlisted <Num value={sim.waitlist} onChange={(x) => setG('waitlist', x)} w="w-20" /></label>
                  <label className="flex items-center gap-1.5">Cancellations <Num value={sim.cancellations} onChange={(x) => setG('cancellations', x)} w="w-20" /></label>
                  <span className="ml-auto">Allocated <span className="text-ink">{inr(T.budget)}</span> of {inr(T.cap)} {T.budget > T.cap ? <span className="text-rose-700 font-medium">· over cap by {inr(T.budget - T.cap)}</span> : <span>· headroom {inr(T.cap - T.budget)}</span>}</span>
                </div>
              </Card>
            )}

            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3">
                <div className="mr-auto"><div className="text-[13px] font-semibold">Task tracker</div><div className="text-[12px] text-mute num">{tasks.filter((t) => t.status !== 'Done').length} open · committed {inr(T.taskBudget)}</div></div>
                <select value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)} className="px-2 text-[12.5px]" aria-label="Filter tasks">
                  <option>All</option>{TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}{BETS.map((b) => <option key={b.id} value={b.id}>{b.id} {b.short}</option>)}
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead><tr>{['Task', 'Campaign', 'Owner', 'Deadline', 'Status', 'Budget ₹', ''].map((h, i) => <Th key={h + i} right={i === 5}>{h}</Th>)}</tr></thead>
                  <tbody>
                    {filteredTasks.map((t) => { const late = t.status !== 'Done' && t.deadline && !isHist && t.deadline < simToday(sim.weeksOut); return (
                      <tr key={t.id} className="border-b border-line hover:bg-faint/40">
                        <td className="py-1.5 px-3 min-w-[280px]"><div className="flex items-center gap-2"><input value={t.task} onChange={(e) => updTask(t.id, 'task', e.target.value)} className="w-full px-2" />{t.source && <span className="shrink-0 font-mono text-[10.5px] text-brand bg-brand-soft rounded px-1.5 h-5 inline-flex items-center">copilot</span>}</div></td>
                        <td className="px-1.5"><select value={t.campaign} onChange={(e) => updTask(t.id, 'campaign', e.target.value)} className="px-2">{BETS.map((b) => <option key={b.id} value={b.id}>{b.id} {b.short}</option>)}</select></td>
                        <td className="px-1.5"><select value={t.owner} onChange={(e) => updTask(t.id, 'owner', e.target.value)} className="px-2">{[...new Set([...OWNERS, t.owner])].map((o) => <option key={o}>{o}</option>)}</select></td>
                        <td className="px-1.5"><input type="date" value={t.deadline} onChange={(e) => updTask(t.id, 'deadline', e.target.value)} className={`px-2 ${late ? 'text-rose-700 border-rose-200' : ''}`} /></td>
                        <td className="px-1.5"><select value={t.status} onChange={(e) => updTask(t.id, 'status', e.target.value)} className={`px-2 ${t.status === 'Blocked' ? 'text-rose-700' : t.status === 'Done' ? 'text-emerald-700' : ''}`}>{TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></td>
                        <td className="px-1.5 text-right"><Num value={t.budget} onChange={(v) => updTask(t.id, 'budget', v)} w="w-24" /></td>
                        <td className="px-2"><Btn kind="ghost" className="!h-7 !px-1.5" aria-label="Delete task" onClick={() => setTasks((ts) => ts.filter((x) => x.id !== t.id))}><Trash2 {...I} /></Btn></td>
                      </tr>); })}
                    <tr className="bg-faint/50">
                      <td className="py-2 px-3"><input placeholder="New task" value={newTask.task} onChange={(e) => setNewTask({ ...newTask, task: e.target.value })} className="w-full px-2" /></td>
                      <td className="px-1.5"><select value={newTask.campaign} onChange={(e) => setNewTask({ ...newTask, campaign: e.target.value, owner: betById(e.target.value).owner })} className="px-2">{BETS.map((b) => <option key={b.id} value={b.id}>{b.id} {b.short}</option>)}</select></td>
                      <td className="px-1.5"><select value={newTask.owner} onChange={(e) => setNewTask({ ...newTask, owner: e.target.value })} className="px-2">{OWNERS.map((o) => <option key={o}>{o}</option>)}</select></td>
                      <td className="px-1.5"><input type="date" value={newTask.deadline} onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })} className="px-2" /></td>
                      <td className="px-1.5"><select value={newTask.status} onChange={(e) => setNewTask({ ...newTask, status: e.target.value })} className="px-2">{TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></td>
                      <td className="px-1.5 text-right"><Num value={newTask.budget} onChange={(v) => setNewTask({ ...newTask, budget: v })} w="w-24" /></td>
                      <td className="px-2"><Btn kind="primary" disabled={!newTask.task.trim()} onClick={() => { setTasks((ts) => [...ts, { ...newTask, id: uid(), budget: Number(newTask.budget) || 0 }]); setNewTask({ ...newTask, task: '', budget: 0 }); }}><Plus {...I} />Add</Btn></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-px bg-line border-t border-line">
                {view.campaigns.map((c) => <div key={c.id} className="bg-card px-4 py-3 text-[12px]"><div className="label !text-[10.5px]"><span className="font-mono normal-case tracking-normal">{c.id}</span> task ₹ / budget</div><div className="num mt-0.5 text-ink">{inrK(c.taskBudget)} <span className="text-mute">/ {inrK(c.budget)}</span></div><div className="h-1 bg-faint mt-1.5 rounded-sm overflow-hidden"><div className="h-1" style={{ width: Math.min(100, c.budget ? (c.taskBudget / c.budget) * 100 : 0) + '%', background: c.taskBudget > c.budget ? DOT.STOP : C.brand }} /></div></div>)}
              </div>
            </Card>
          </Section>
          <footer className="text-[11.5px] text-mute pb-2">Sources: Attendee_Dataset.xlsx (CampusFest 2025, synthetic) [DATA]; Part 1 strategy targets, thresholds and Delhi NCR venue cap [ASSUMPTION]. State saves in this browser only.</footer>
        </main>

        {/* Copilot rail */}
        {open && (
          <aside className="fixed xl:sticky z-40 top-0 xl:top-[89px] right-0 h-screen xl:h-[calc(100vh-89px)] w-full sm:w-[380px] xl:w-auto bg-card border-l border-line flex flex-col">
            <div className="px-4 h-12 border-b border-line flex items-center gap-2 shrink-0">
              <MessageSquareText {...I} className="text-mute" />
              <div className="text-[13px] font-semibold mr-auto">Growth Copilot</div>
              <Btn kind="ghost" className="!h-7 text-[12px]" onClick={() => setChat([])}>Clear</Btn>
              <Btn kind="ghost" className="!h-7 !px-1.5" aria-label="Close Copilot" onClick={() => setOpen(false)}><X {...I} /></Btn>
            </div>
            <div className="px-4 py-3 border-b border-line space-y-2 text-[12px] shrink-0">
              <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full px-2" aria-label="Copilot provider">
                <option value="auto">Auto · API key → Claude built-in → rules</option>
                <option value="api">Anthropic API key</option>
                <option value="builtin" disabled={!sample}>Claude built-in{sample ? '' : ' (unavailable here)'}</option>
                <option value="rules">Deterministic engine (offline)</option>
              </select>
              {(provider === 'api' || provider === 'auto') && (
                <div className="flex gap-2">
                  <input type="password" autoComplete="off" placeholder="sk-ant-… (memory only)" value={apiKey} onChange={(e) => setApiKey(e.target.value.trim())} className="flex-1 px-2 font-mono" />
                  <input value={model} onChange={(e) => setModel(e.target.value)} className="w-[132px] px-2 font-mono" aria-label="Model" />
                </div>
              )}
              <div className="flex items-center gap-1.5 text-mute"><span className={`w-1.5 h-1.5 rounded-full ${effProvider === 'rules' ? 'bg-zinc-400' : 'bg-emerald-600'}`} />via <span className="text-ink font-medium">{effProvider === 'api' ? 'Anthropic API' : effProvider === 'builtin' ? 'Claude built-in' : 'deterministic engine'}</span><span className="ml-auto font-mono text-[11px] num">{isHist ? 'hist' : 'sim'} · {tasks.length} tasks · {view.alerts.length} alerts</span></div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-[12.5px] leading-[1.55]">
              {chat.length === 0 && <div className="text-mute">Ask about live funnel numbers, threshold breaches, budget moves or tasks. Every answer is computed from the current app state.</div>}
              {chat.map((m) => (
                <div key={m.id}>
                  {m.role === 'user' ? <div className="ml-10 bg-faint border border-line rounded-md px-3 py-2 text-ink">{m.content}</div> : (
                    <div>
                      <Md text={m.content} />
                      <div className="font-mono text-[10.5px] text-zinc-400 mt-1.5">{m.via}</div>
                      {m.note && <div className="text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mt-1.5">{m.note}</div>}
                      {m.proposals?.length > 0 && <div className="mt-2.5 space-y-2">{m.proposals.map((p) => (
                        <div key={p.pid} className="border border-line rounded-md p-3 text-[12px]">
                          <div className="font-medium text-ink">{p.task}</div>
                          <div className="font-mono text-[11px] text-mute mt-1 num">{p.campaign} · {p.owner} · {p.deadline || 'no deadline'} · {inr(p.budget)}{p.budgetMove ? ` · ${p.budgetMove.from}→${p.budgetMove.to} ${inr(p.budgetMove.amount)}` : ''}</div>
                          {p.state === 'pending' ? <div className="flex gap-2 mt-2.5"><Btn kind="primary" className="!h-7 text-[12px]" onClick={() => approve(m.id, p.pid)}><Check {...I} />Approve &amp; Add to Task Manager</Btn><Btn className="!h-7 text-[12px]" onClick={() => dismiss(m.id, p.pid)}>Dismiss</Btn></div>
                            : <div className={`mt-2 flex items-center gap-1.5 ${p.state === 'added' ? 'text-emerald-700' : 'text-mute'}`}>{p.state === 'added' ? <><CircleCheck size={14} strokeWidth={1.75} />Added{p.applied || ''}</> : 'Dismissed'}</div>}
                        </div>))}</div>}
                    </div>)}
                </div>))}
              {busy && <div className="text-mute font-mono text-[11.5px]">Analysing live state…</div>}
              <div ref={chatEnd} />
            </div>
            <div className="border-t border-line px-4 py-3 shrink-0">
              <div className="flex flex-wrap gap-1.5 mb-2.5">{STARTERS.map((s) => <button key={s.label} onClick={() => ask(s.q)} disabled={busy} className="h-7 px-2 rounded-md border border-line text-[11.5px] text-ink hover:bg-faint disabled:opacity-40">{s.label}</button>)}</div>
              <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the Copilot" className="flex-1 px-2.5 !h-8" />
                <Btn kind="primary" disabled={busy || !input.trim()} aria-label="Send"><Send {...I} /></Btn>
              </form>
            </div>
          </aside>
        )}
      </div>

      {exportText && (
        <div className="fixed inset-0 z-50 bg-zinc-900/30 flex items-center justify-center p-4" onClick={() => setExportText(null)}>
          <div className="bg-card rounded-md border border-line w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 h-12 border-b border-line"><span className="font-mono text-[12px] mr-auto">{exportText.filename}</span>
              <Btn kind="primary" onClick={() => navigator.clipboard?.writeText(exportText.data).then(() => setToast('Copied'), () => setToast('Copy blocked — select the text manually'))}><Copy {...I} />Copy</Btn>
              <Btn kind="ghost" className="!px-1.5" aria-label="Close" onClick={() => setExportText(null)}><X {...I} /></Btn></div>
            <div className="p-4">
              <p className="text-[12px] text-mute mb-2">If the browser blocked the download, copy the contents below.</p>
              <textarea readOnly value={exportText.data} className="w-full h-72 font-mono text-[11px] p-2" />
            </div>
          </div>
        </div>
      )}
      {toast && <div className="fixed bottom-4 left-4 z-50 bg-ink text-white text-[12.5px] rounded-md px-3 h-9 inline-flex items-center gap-2"><CircleCheck size={14} strokeWidth={1.75} />{toast}</div>}
    </div>
  );
}
