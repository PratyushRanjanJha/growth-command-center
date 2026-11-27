// AI Growth Copilot: live context, LLM providers, deterministic fallback engine.
import { HIST } from './histData.js';
import { THRESHOLDS, ALERT_RULES, CAP_DAY, DAY1_SHARE, SCENARIOS, fmt, inr, pct, betById, simToday, addDays, EVENT_DATE } from './model.js';

export const INSUFFICIENT = 'Insufficient data in current dataset to answer this.';

export const STARTERS = [
  { label: 'Funnel diagnosis', q: 'Diagnose our funnel: where is the steepest drop-off, which campaigns breach thresholds, and what is the gap to target?' },
  { label: 'Budget reallocation', q: 'How should we reallocate remaining budget across campaigns based on current CAC and status thresholds?' },
  { label: 'Action creation', q: 'Create trackable tasks for every campaign that is breaching a threshold right now.' },
  { label: 'Out-of-scope test', q: 'What was the post-event NPS and how much sponsor revenue did we collect?' },
];

const COVERAGE = 'Covered: platform reach/impressions/clicks/sessions/form starts, spend (INR), identified people, engagement events (page visits, brochure downloads, questions, nurture emails, opt-outs), registrations, registration status history, verified check-ins (2 days), targets, plus the simulation fields in this app (budgets, leading indicators, tasks).';
const MISSING_RE = /\b(nps|net promoter|satisfaction|survey|sponsor\w*|revenue|ticket price|profit|weather|rain|rainfall|temperature|food|f&b|merch(?:andise)? sales|gender|age|ages|age group|demographic\w*|income|sentiment|followers|competitor\w*|safety|security incident|artist fee|headliner fee|dwell time|ltv|lifetime value)\b/;

export function buildContext(view, tasks) {
  const c = view.campaigns.map((x) => ({
    id: x.id, name: x.name, rank: x.rank, decision: x.decision, overlay: !!x.overlay, owner: x.owner, rice: x.rice, riceInputs: x.riceIn, timeline: x.timeline, testDesign: x.test, pivotAction: THRESHOLDS[x.id]?.pivot || THRESHOLDS.ECON.pivot,
    budget: x.budget, spend: x.spend, reach: x.reach, identified: x.identified, registrations: x.regs, confirmed: x.confirmed, attendees: x.attendees,
    cac: x.cac == null ? null : Math.round(x.cac), costPerReg: x.cpr == null ? null : Math.round(x.cpr), regToAttendPct: x.regToAtt == null ? null : +(x.regToAtt * 100).toFixed(1),
    indicators: Object.fromEntries(['liftPp', 'optOutPct', 'k', 'inviteeShowPct', 'shareRatePct', 'daysLive', 'mous', 'rosterFillPct', 'activePct', 'topQRegsWk'].filter((k) => x[k] != null).map((k) => [k, x[k]])),
    status: x.status, statusBasis: x.basis, reasons: x.reasons.map((r) => `${r.verdict}: ${r.rule} (${r.detail})`), openTasks: x.openTasks,
    ...(view.isHist ? { historicalProxyChannels: x.sources || (x.overlay ? 'all channels (not run in 2025)' : '') } : {}),
  }));
  return {
    mode: view.isHist ? 'HISTORICAL BASELINE — exact CampusFest 2025 dataset [DATA]' : 'ACTIVE CAMPAIGN SIMULATION — CampusFest 2027 Delhi NCR, values entered by team [SIMULATION]',
    simToday: view.isHist ? '2025-04-20 (post-event)' : simToday(view.weeksOut), eventDate: view.isHist ? '2025-04-12/13' : EVENT_DATE, weeksToEvent: view.weeksOut,
    target: view.target,
    totals: { ...view.tot, regToAttendPct: +(view.tot.regToAtt * 100).toFixed(1), cac: Math.round(view.tot.cac), capUtilPct: +(view.tot.capUtil * 100).toFixed(1) },
    funnelSteps: view.steps.map((s) => ({ step: s.step, conversionPct: s.conv == null ? null : +(s.conv * 100).toFixed(1), targetPct: s.tgt == null ? null : +(s.tgt * 100).toFixed(1), lost: s.lost })),
    steepestDrop: view.steepest?.step, highestCACLine: view.highestCAC ? { name: view.highestCAC.name, cac: Math.round(view.highestCAC.cac) } : null,
    campaigns: c,
    liveAlerts: view.alerts.map((a) => `${a.rule}: ${a.text}`),
    thresholds: THRESHOLDS, alertRules: ALERT_RULES,
    pacing: { expectedShare: +(view.pace * 100).toFixed(1), expectedRegs: Math.round(view.paceTarget) }, waitlist: view.waitlist, cancellations: view.cancellations,
    tasks: tasks.map(({ id, task, campaign, owner, deadline, status, budget }) => ({ id, task, campaign, owner, deadline, status, budget })),
    historical2025: {
      channels: HIST.channels.map((h) => ({ name: h.name, spend: h.spend, reach: h.reach, identified: h.identified, regs: h.regs, confirmed: h.confirmed, attendees: h.attendees, optOuts: h.optOuts })),
      uniqueAttendees: HIST.uniqueAttendees, walkIns: HIST.walkIns, day1: HIST.day1, day2: HIST.day2, bothDays: HIST.bothDays, targets: HIST.targets,
      insights: ['Brochure download → 74.7% attendance vs 61.9% without', 'Submitted question → 79.4% vs 68.0%', 'Nurture emails: no lift (69.1% vs 68.7%)', 'Registered 30–60 days before event: 63% show vs 72–73% within 30 days', '88 waitlisted and 183 cancelled registrants: 0 attended'],
    },
    assumptions: [`Venue cap ${CAP_DAY}/day [ASSUMPTION]`, `Day-1 share of uniques ${(DAY1_SHARE * 100).toFixed(1)}% [DATA]`, 'Base 3,000 / stretch 5,000 attendees at ₹100 CAC [ASSUMPTION]', 'Diminishing returns: reallocated ₹ yield 80% of current CAC efficiency [ASSUMPTION]', 'Delhi NCR, 2027 dates [ASSUMPTION]'],
    datasetCoverage: COVERAGE,
  };
}

export function systemPrompt(ctx) {
  return `You are the embedded AI Growth Analyst & Copilot for a Tier-1 college festival (Challenge A: maximise verified attendees). Answer ONLY from the LIVE_STATE JSON below; never use generic knowledge for numbers.
Rules:
1. Quantitative answers: compute exactly from LIVE_STATE and show the arithmetic briefly. Tag every claim [DATA] (from dataset/live state), [SIMULATION] (team-entered simulation values) or [ASSUMPTION].
2. Diagnoses: name the campaign, its status, and the exact threshold breached with value vs threshold (from campaigns[].reasons and thresholds).
3. If the question needs a metric that is not in LIVE_STATE (e.g. NPS, sponsor revenue, weather, demographics), reply with exactly "${INSUFFICIENT}" on the first line, then say what is missing and the closest available proxy.
4. When recommending actions, propose trackable tasks. Append them at the very end as a fenced block labelled tasks containing a JSON array: [{"task":"...","campaign":"B1|B2|B3|B4|B5|ORG","owner":"Meera Iyer|Arjun Verma|Nisha Rao|Dev Malhotra","deadline":"YYYY-MM-DD","budget":0,"budgetMove":{"from":"B5","to":"B3","amount":10000}}]. budgetMove is optional and only in simulation mode. The user approves each task before it is added.
5. Be terse: bullets, ≤ 180 words before the tasks block. Use **bold** sparingly. No preamble.
LIVE_STATE:
${JSON.stringify(ctx)}`;
}

export function parseReply(text) {
  const m = text.match(/```tasks\s*([\s\S]*?)```/i) || text.match(/```json\s*(\[[\s\S]*?\])\s*```/i);
  let proposals = [];
  if (m) {
    try { const arr = JSON.parse(m[1]); if (Array.isArray(arr)) proposals = arr.filter((p) => p && p.task).map(normProposal); } catch { proposals = []; }
  }
  return { text: text.replace(/```(tasks|json)[\s\S]*?```/gi, '').trim(), proposals };
}

function normProposal(p) {
  const ok = ['B1', 'B2', 'B3', 'B4', 'B5', 'ORG'];
  return {
    task: String(p.task).slice(0, 240), campaign: ok.includes(p.campaign) ? p.campaign : 'B1', owner: String(p.owner || betById(p.campaign)?.owner || 'Arjun Verma'),
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(p.deadline || '') ? p.deadline : '', budget: Math.max(0, Math.round(Number(p.budget) || 0)),
    budgetMove: p.budgetMove && ok.includes(p.budgetMove.from) && ok.includes(p.budgetMove.to) && Number(p.budgetMove.amount) > 0 ? { from: p.budgetMove.from, to: p.budgetMove.to, amount: Math.round(Number(p.budgetMove.amount)) } : null,
  };
}

// ---------- LLM providers ----------
export async function callAnthropic({ apiKey, model, system, history }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model, max_tokens: 1200, system, messages: history }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

export async function callBuiltIn({ sample, system, history }) {
  const msgs = history.map((m, i) => (i === history.length - 1 && m.role === 'user' ? { role: 'user', content: system + '\n\nQUESTION: ' + m.content } : m));
  const r = await sample(msgs, { cache: false, modelTier: 'default' });
  return r.text;
}

// ---------- Deterministic fallback engine ----------
const lc = (s) => s.toLowerCase();
const statusLine = (c) => `**${c.id} ${c.short}** — ${c.status}: ${c.reasons.filter((r) => r.verdict === c.status).map((r) => `${r.rule} (${r.detail})`).join('; ') || c.basis}`;

function deadlineIn(view, days) { return addDays(view.isHist ? '2026-12-01' : simToday(view.weeksOut), days); }

function actionFor(c, view) {
  const d = (n) => deadlineIn(view, n);
  const map = {
    B1: { SCALE: ['Roll reminder sequence to 100% of confirmed; add phone call to non-responders at T-72h', 8000, 3], CHANGE: ['Cut reminder cadence to 1 message; rewrite copy and re-test vs control', 0, 2], MONITOR: ['Extend 10% holdout test 7 more days to read show-up lift', 0, 7] },
    B2: { SCALE: ['Raise referral reward tier (priority entry + merch at 3 verified friends)', 10000, 4], CHANGE: ['Move referral prompt to WhatsApp confirmation message', 0, 3], STOP: ['Stop referral rewards (k < 0.10)', 0, 2], MONITOR: ['A/B test higher reward tier on 20% of registrants to push k ≥ 0.30', 5000, 7] },
    B3: { SCALE: ['Add 5 colleges and 4 buses from metro hubs to squad programme', 20000, 5], CHANGE: ['Convert low-fill squads to pay-per-seat buses (fill < 50% at T-4w)', 0, 3], STOP: ['Stop new squad MoUs; switch to pay-per-seat buses', 0, 2], MONITOR: ['Chase group leaders below 60% roster fill', 0, 4] },
    B4: { SCALE: ['Clone top-quartile ambassadors into 10 adjacent colleges', 15000, 7], CHANGE: ['Prune ambassadors with 0 registrations in 14 days; re-recruit 20', 0, 4], STOP: ['Stop ambassador programme; pay out earned bounties only', 0, 2], MONITOR: ['Review ambassador leaderboard; coach bottom quartile', 0, 5] },
    B5: { SCALE: ['Add ₹10K/week to retargeting (capped)', 10000, 3], STOP: ['Pause breaching ad sets; keep only brochure-downloader retargeting', 0, 1], MONITOR: ['Restrict audience to brochure-downloaders; re-check CPR in 7 days', 0, 7] },
    ORG: { SCALE: ['Refresh festival SEO pages with line-up + FAQ', 0, 7], MONITOR: ['Audit organic landing page conversion', 0, 7] },
  };
  const a = map[c.id]?.[c.status];
  if (!a) return null;
  let budgetMove = null, task = a[0];
  if (!view.isHist && !c.overlay && (c.status === 'STOP' || c.status === 'CHANGE')) {
    const named = view.campaigns.find((x) => x.id === THRESHOLDS[c.id]?.pivotTo && x.status !== 'STOP' && x.status !== 'CHANGE');
    const dest = named || view.campaigns.filter((x) => !x.overlay && x.id !== c.id && x.id !== 'ORG' && x.status === 'SCALE' && x.cac != null).sort((p, q) => p.cac - q.cac)[0];
    const amount = Math.floor(((c.status === 'STOP' ? 1 : 0.5) * Math.max(0, c.budget - c.spend)) / 500) * 500;
    if (dest && amount > 0) { budgetMove = { from: c.id, to: dest.id, amount }; task += ` · pivot ${inr(amount)} unspent → ${dest.short}`; }
  }
  return { task, campaign: c.id, owner: c.owner, deadline: d(a[2]), budget: view.isHist ? 0 : a[1], budgetMove };
}

function reallocation(view) {
  const src = view.campaigns.filter((c) => !c.overlay && (c.status === 'STOP' || c.status === 'CHANGE'));
  const dest = view.campaigns.filter((c) => !c.overlay && c.status === 'SCALE' && c.cac != null && c.id !== 'ORG').sort((a, b) => a.cac - b.cac);
  return { src, dest };
}

export function deterministic(q, view, tasks) {
  const s = lc(q);
  const T = view.tot, tgt = view.target, tag = view.isHist ? '[DATA]' : '[SIMULATION]';
  const mm = s.match(MISSING_RE); const missing = mm ? mm[1] : null;
  if (missing) {
    return { text: `${INSUFFICIENT}\n- Requested metric (“${missing.trim()}”) is not in the dataset or live state.\n- ${COVERAGE}\n- Closest proxy: verified attendance ${fmt(T.total)} ${tag}, reg→attend ${pct(T.regToAtt)} ${tag}, opt-out rates per channel.`, proposals: [] };
  }
  const named = view.campaigns.find((c) => s.includes(c.id.toLowerCase() + ' ') || s.endsWith(c.id.toLowerCase()) || s.includes(c.short.toLowerCase()) || s.includes(c.name.toLowerCase()));

  if (/realloc|budget|shift|move money|spend/.test(s)) {
    const { src, dest } = reallocation(view);
    const lines = [`**Budget** ${inr(T.spend)} spent of ${inr(T.cap)} cap (${pct(T.spend / T.cap)}) ${tag}; allocated ${inr(T.budget)}; task commitments ${inr(T.taskBudget)}.`];
    const proposals = [];
    if (!src.length || !dest.length) {
      lines.push(`- No reallocation triggered: ${!src.length ? 'no acquisition line is in STOP/CHANGE' : 'no SCALE destination with measurable CAC'}.`);
    } else {
      src.forEach((c) => {
        const named = view.campaigns.find((x) => x.id === THRESHOLDS[c.id]?.pivotTo && x.status !== 'STOP' && x.status !== 'CHANGE');
        const to = named && (named.cac != null) ? named : dest[0];
        const remaining = view.isHist ? Math.max(0, c.spend - 40000) : Math.max(0, c.budget - c.spend);
        const amount = Math.floor(((c.status === 'STOP' ? 1 : 0.5) * remaining) / 500) * 500;
        const gain = amount && to.cac ? Math.round((amount / to.cac) * 0.8) : 0;
        lines.push(`- **${c.id} ${c.short}** is ${c.status} (${c.reasons.filter((r) => r.verdict === c.status).map((r) => r.detail).join('; ')}). ${view.isHist ? `Next cycle: keep ₹40K retargeting, free ${inr(amount)} of ${inr(c.spend)} [DATA]` : `Remaining ${inr(c.budget - c.spend)} → move ${c.status === 'STOP' ? '100%' : '50%'} = ${inr(amount)}`}.`);
        lines.push(`  → to **${to.id} ${to.short}** (${to === dest[0] ? 'lowest SCALE CAC' : 'pre-set pivot target, CAC'} ${inr(to.cac)} ${tag}): ≈ +${fmt(gain)} attendees at 80% efficiency [ASSUMPTION].`);
        if (amount > 0) proposals.push({ task: `Reallocate ${inr(amount)} from ${c.short} to ${to.short}`, campaign: to.id, owner: to.owner, deadline: deadlineIn(view, 2), budget: amount, budgetMove: view.isHist ? null : { from: c.id, to: to.id, amount } });
      });
    }
    return { text: lines.join('\n'), proposals };
  }

  if (/task|action|create|todo|to-do|plan|fix/.test(s)) {
    const flagged = view.campaigns.filter((c) => c.status !== 'MONITOR' || c.reasons.some((r) => r.verdict !== 'SCALE' && r.verdict !== 'MONITOR'));
    const proposals = flagged.map((c) => actionFor(c, view)).filter(Boolean);
    if (view.waitlist > 0 && view.cancellations > 0) proposals.push({ task: `Release ${fmt(Math.min(view.waitlist, view.cancellations))} waitlist seats against cancellations`, campaign: 'B1', owner: 'Arjun Verma', deadline: deadlineIn(view, 1), budget: 0, budgetMove: null });
    const lines = [`**${proposals.length} proposed tasks** from live threshold status (approve individually):`, ...flagged.map((c) => '- ' + statusLine(c))];
    return { text: lines.join('\n'), proposals };
  }

  if (named && !/funnel|bottleneck|diagnos/.test(s)) {
    const c = named;
    const lines = [`**${c.id} ${c.name}** — ${c.status} (basis: ${c.basis}) ${tag}`,
      `- Spend ${inr(c.spend)} / budget ${inr(c.budget)}; reach ${fmt(c.reach)}; identified ${fmt(c.identified)}; regs ${fmt(c.regs)}; confirmed ${fmt(c.confirmed)}; attendees ${fmt(c.attendees)}${c.overlay ? ' (incremental vs control)' : ''}.`,
      `- CAC ${inr(c.cac)} = ${inr(c.spend)} ÷ ${fmt(c.attendees)}; cost/reg ${inr(c.cpr)}; reg→attend ${pct(c.regToAtt)}.`,
      ...c.reasons.map((r) => `- ${r.verdict}: ${r.rule} — ${r.detail}`),
      `- Thresholds: scale if ${THRESHOLDS[c.id]?.scale || THRESHOLDS.ECON.scale}; stop if ${THRESHOLDS[c.id]?.stop || THRESHOLDS.ECON.stop}.`];
    const a = actionFor(c, view);
    return { text: lines.join('\n'), proposals: a ? [a] : [] };
  }

  if (/funnel|bottleneck|diagnos|drop|underperform|why|problem|gap/.test(s) || s.trim() === '') {
    const st = view.steepest;
    const lines = [
      `**Gap to target:** ${fmt(T.total)} attendees vs ${fmt(tgt.total)} (${pct(T.total / tgt.total)}; gap ${fmt(tgt.total - T.total)}) ${tag}.`,
      `**Steepest drop-off (${st.basis}):** ${st.step} at ${pct(st.conv)} (${fmt(st.lost)} lost${st.tgt ? `; plan ${pct(st.tgt)}` : ''}) ${tag}.`,
      ...view.steps.filter((x) => x !== st).map((x) => `- ${x.step}: ${pct(x.conv)} (${fmt(x.lost)} lost${x.tgt ? `, plan ${pct(x.tgt)}` : ''})`),
      `**Highest CAC:** ${view.highestCAC.name} ${inr(view.highestCAC.cac)} vs blended ${inr(T.cac)} ${tag}.`,
      '**Threshold status:**', ...view.campaigns.filter((c) => c.status !== 'SCALE').map((c) => '- ' + statusLine(c)),
      view.alerts.length ? '**Live alerts:** ' + view.alerts.map((a) => `${a.rule} ${a.text}`).join(' | ') : '**Live alerts:** none',
    ];
    if (view.isHist) lines.push('- 2025 insight [DATA]: brochure download → 74.7% attendance vs 61.9%; nurture emails no lift (69.1% vs 68.7%).');
    const proposals = view.campaigns.filter((c) => c.status === 'STOP' || c.status === 'CHANGE').map((c) => actionFor(c, view)).filter(Boolean);
    return { text: lines.join('\n'), proposals };
  }

  if (/cac|cost|efficien|cheap|expensive/.test(s)) {
    const rows = [...view.lineCAC].filter((c) => c.cac != null).sort((a, b) => a.cac - b.cac);
    return { text: [`**Blended CAC** ${inr(T.cac)} = ${inr(T.spend)} ÷ ${fmt(T.total)} attendees ${tag}. Plan: ₹100 [ASSUMPTION].`, ...rows.map((r) => `- ${r.name}: ${inr(r.cac)} (reg→attend ${pct(r.regToAtt)}${r.optOutPct != null ? `, opt-out ${r.optOutPct.toFixed(1)}%` : ''})`)].join('\n'), proposals: [] };
  }

  if (/capacity|venue|footfall|day.?1|crowd/.test(s)) {
    return { text: `**Day-1 footfall** ${fmt(T.day1)} = ${fmt(T.total)} × ${(DAY1_SHARE * 100).toFixed(1)}% [DATA share] → ${pct(T.capUtil)} of ${fmt(CAP_DAY)}/day cap [ASSUMPTION]. Ceiling before breach ≈ ${fmt(CAP_DAY / DAY1_SHARE)} unique attendees.`, proposals: [] };
  }

  if (/attend|registr|how many|total|kpi|reach|conversion|status|summary|where are we/.test(s)) {
    return { text: [`**KPIs** ${tag}`, `- Reach ${fmt(T.reach)}; identified ${fmt(T.identified)}; registrations ${fmt(T.regs)}; confirmed ${fmt(T.confirmed)}.`, `- Attendees ${fmt(T.total)} = ${fmt(T.attendedReg)} registered + ${fmt(T.walkIns)} walk-ins; target ${fmt(tgt.total)}.`, `- Reg→attend ${pct(T.regToAtt)}; blended CAC ${inr(T.cac)}; spend ${inr(T.spend)} of ${inr(T.cap)}.`, `- Pacing: ${fmt(T.regs)} regs vs ${fmt(Math.round(view.paceTarget))} expected at T-${view.weeksOut}w (${pct(view.pace)} of ${fmt(tgt.regs)}).`].join('\n'), proposals: [] };
  }

  return { text: `${INSUFFICIENT}\n- I could not map this question to a metric in the live state. ${COVERAGE}\n- Try: funnel diagnosis, CAC by campaign, budget reallocation, capacity, or a campaign id (B1–B5).`, proposals: [] };
}

export const SCENARIO_NOTE = `Base ${fmt(SCENARIOS.base.total)} / stretch ${fmt(SCENARIOS.stretch.total)}`;
