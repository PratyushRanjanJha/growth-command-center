// Growth model: Part 1 strategy constants, simulation seed, metric engine, thresholds, alerts.
import { HIST } from './histData.js';

// ---------- Constants from Part 1 ----------
export const CAP_DAY = 4000; // [ASSUMPTION] venue gate capacity per day
export const DAY1_SHARE = HIST.day1 / HIST.uniqueAttendees; // [DATA] 1,430 / 2,050 = 69.8%
export const EVENT_DATE = '2027-02-13'; // [ASSUMPTION] CampusFest 2027, Delhi NCR (13–14 Feb)
export const OWNERS = ['Meera Iyer', 'Arjun Verma', 'Nisha Rao', 'Dev Malhotra'];
export const TASK_STATUSES = ['To do', 'In progress', 'Blocked', 'Done'];
export const STATUS_ORDER = { SCALE: 0, MONITOR: 1, CHANGE: 2, STOP: 3 };

// Historical registration pacing: [weeks before event, cumulative share] [DATA]
export const PACING = [[12, 0], [10, 0.13], [8, 0.27], [6, 0.42], [4, 0.57], [2, 0.82], [0, 1]];
export function pacingShare(weeksOut) {
  const w = Math.max(0, Math.min(12, Number(weeksOut) || 0));
  for (let i = 0; i < PACING.length - 1; i++) {
    const [w1, s1] = PACING[i], [w2, s2] = PACING[i + 1];
    if (w <= w1 && w >= w2) return s1 + ((w1 - w) / (w1 - w2)) * (s2 - s1);
  }
  return 1;
}

// Target funnels
export const SCENARIOS = {
  base: { label: 'Base case', budget: 300000, reach: 800000, identified: 4600, regs: 3680, confirmed: 3300, attendedReg: 2870, walkIns: 130, total: 3000, cac: 100 },
  stretch: { label: 'Ambitious stretch', budget: 500000, reach: 1310000, identified: 7200, regs: 5904, confirmed: 5300, attendedReg: 4723, walkIns: 277, total: 5000, cac: 100 },
};
const T25 = HIST.targets[HIST.targets.length - 1];
export const HIST_TARGET = { label: T25.label + ' (2025)', budget: T25.budget, reach: null, identified: T25.identified, regs: T25.regs, confirmed: null, attendedReg: null, walkIns: null, total: T25.visitors, cac: null };

// Part 1 thresholds (shown in UI and injected into Copilot)
export const THRESHOLDS = {
  B1: { scale: 'Lift vs 10% control ≥ +5 pp AND opt-out < 2%', change: 'Lift < 2 pp OR opt-out > 5% (cut cadence to 1 message)', stop: 'n/a (never stop reminders; change cadence instead)', kpi: 'Confirmed → attended %', pivot: 'One message only; rewrite copy; no budget move' },
  B2: { pivotTo: 'B3', scale: 'k ≥ 0.30 AND invitee show-up ≥ 75%', change: 'Share rate < 15% (move prompt to WhatsApp)', stop: 'k < 0.10 after ≥ 14 days live', kpi: 'Viral coefficient k', pivot: 'Unspent (≤ ₹25K base) → Squad Passes buses' },
  B3: { pivotTo: 'B2', scale: '≥ 25 MoUs AND roster fill ≥ 70%', change: 'Roster fill < 50% at ≤ T-4w', stop: '< 10 MoUs at ≤ T-6w', kpi: 'Roster fill %', pivot: 'Switch to pay-per-seat buses; unspent (≤ ₹50K) → Referral rewards' },
  B4: { pivotTo: 'B1', scale: 'Top-quartile ≥ 15 regs/week AND cost/registration ≤ ₹100', change: 'Active ambassadors < 50%', stop: 'Cost/registration > ₹200 at ≤ T-4w', kpi: 'Attendees per active ambassador', pivot: 'Prune inactive; unspent (≤ ₹30K) → Show-up Rescue calls' },
  B5: { pivotTo: 'B3', scale: 'Cost/registration ≤ ₹110 AND confirm rate ≥ 88%', change: 'n/a', stop: 'Cost/registration > ₹180 OR opt-out > 8%', kpi: 'Cost per confirmed registrant', pivot: 'Pause ad sets; remainder → Squad Passes' },
  ECON: { scale: 'CAC ≤ ₹110 AND reg→attend ≥ 75%', change: 'CAC > ₹150', stop: 'CAC > ₹180 OR reg→attend < 55%', kpi: 'CAC per attendee (guardrail for all acquisition bets)', pivot: 'Default: unspent budget of a STOP bet (50% of a CHANGE bet) → lowest-CAC bet at SCALE, after owner approval' },
};

export const ALERT_RULES = [
  { id: 'R1', name: 'Attendance forecast gap', rule: 'Projected attendees < 95% of target' },
  { id: 'R2', name: 'Channel efficiency drift', rule: 'Any channel CAC > ₹150 OR opt-out > 8%' },
  { id: 'R3', name: 'Pace & capacity', rule: 'Registrations < 90% of pacing curve, OR Day-1 footfall > 3,600, OR waitlist > 0 while cancellations > 0' },
];

// Bets (Part 1, ranked by RICE) + organic baseline
export const BETS = [
  { id: 'B1', rank: 1, name: 'Show-up Rescue Engine', short: 'Show-up Rescue', owner: 'Arjun Verma', overlay: true, rice: 1963, riceIn: '3,680 × 2 × 80% ÷ 3', timeline: 'Build T-6w, live T-3w', test: '10% no-reminder holdout', decision: 'Double down', proxy: [] },
  { id: 'B2', rank: 2, name: 'Referral Loop v2', short: 'Referral Loop', owner: 'Dev Malhotra', rice: 1288, riceIn: '3,680 × 1.5 × 70% ÷ 3', timeline: 'Launch T-8w', test: 'A/B reward tier on 20%', decision: 'Double down', proxy: ['C05'] },
  { id: 'B3', rank: 3, name: 'College Squad Passes + metro buses', short: 'Squad Passes', owner: 'Meera Iyer', rice: 875, riceIn: '2,500 × 3 × 70% ÷ 6', timeline: 'MoUs by T-6w', test: 'Pilot 5 colleges first', decision: 'Double down', proxy: ['C04', 'C07'] },
  { id: 'B4', rank: 4, name: 'Ambassadors paid per verified attendee', short: 'Ambassadors', owner: 'Meera Iyer', rice: 270, riceIn: '1,800 × 2 × 60% ÷ 8', timeline: 'Recruit T-11w', test: 'Bounty vs flat cohorts', decision: 'Keep lean', proxy: ['C01'] },
  { id: 'B5', rank: 5, name: 'Paid Social & Creators (retargeting only)', short: 'Paid/Creators', owner: 'Nisha Rao', rice: 250, riceIn: '5,000 × 0.5 × 40% ÷ 4', timeline: 'T-6w to T-1w', test: '7-day CPR read', decision: 'Reject as growth lever', proxy: ['C02', 'C03'] },
  { id: 'ORG', rank: null, name: 'Organic Search (baseline, not a bet)', short: 'Organic', owner: 'Arjun Verma', rice: null, riceIn: null, timeline: 'Always on', test: 'n/a', decision: 'Maintain', proxy: ['C06'] },
];
export const betById = (id) => BETS.find((b) => b.id === id);

export const INDICATOR_FIELDS = {
  B1: [['liftPp', 'Lift vs control (pp)'], ['optOutPct', 'Opt-out %']],
  B2: [['k', 'k-factor'], ['inviteeShowPct', 'Invitee show-up %'], ['shareRatePct', 'Share rate %'], ['daysLive', 'Days live']],
  B3: [['mous', 'MoUs signed'], ['rosterFillPct', 'Roster fill %']],
  B4: [['activePct', 'Active ambassadors %'], ['topQRegsWk', 'Top-quartile regs/week']],
  B5: [['optOutPct', 'Opt-out %']],
  ORG: [],
};
export const CORE_FIELDS = [['budget', 'Budget ₹'], ['spend', 'Spend ₹'], ['reach', 'Reach'], ['identified', 'Identified'], ['regs', 'Registrations'], ['confirmed', 'Confirmed'], ['attendees', 'Attendees']];

// Simulation seed: base-case plan at T-3w, ₹300K budget (allocation from Part 1) [ASSUMPTION]
export function seedSimulation() {
  return {
    weeksOut: 3, scenario: 'base', walkIns: 140, waitlist: 46, cancellations: 72,
    campaigns: {
      B1: { budget: 30000, spend: 24000, reach: 3450, identified: 0, regs: 0, confirmed: 0, attendees: 290, liftPp: 6.2, optOutPct: 1.4 },
      B2: { budget: 44000, spend: 31000, reach: 61000, identified: 690, regs: 590, confirmed: 540, attendees: 455, k: 0.24, inviteeShowPct: 79, shareRatePct: 22, daysLive: 35 },
      B3: { budget: 97000, spend: 74000, reach: 152000, identified: 1180, regs: 1060, confirmed: 990, attendees: 870, mous: 27, rosterFillPct: 73 },
      B4: { budget: 75000, spend: 58000, reach: 118000, identified: 820, regs: 690, confirmed: 610, attendees: 505, activePct: 46, topQRegsWk: 17 },
      B5: { budget: 40000, spend: 36500, reach: 210000, identified: 420, regs: 210, confirmed: 180, attendees: 112, optOutPct: 9.1 },
      ORG: { budget: 14000, spend: 12000, reach: 52000, identified: 330, regs: 290, confirmed: 265, attendees: 228 },
    },
  };
}

export function seedTasks() {
  return [
    { id: 't1', task: 'Build WhatsApp T-7d / T-72h / T-24h reminder flow with QR wallet pass; hold out 10% control', campaign: 'B1', owner: 'Arjun Verma', deadline: '2027-01-16', status: 'Done', budget: 18000 },
    { id: 't2', task: 'Re-confirm registrants who signed up 30–60 days out (63% historical show-up)', campaign: 'B1', owner: 'Arjun Verma', deadline: '2027-01-30', status: 'In progress', budget: 6000 },
    { id: 't3', task: 'Put referral link on confirmation screen + WhatsApp; reward on friend’s verified check-in', campaign: 'B2', owner: 'Dev Malhotra', deadline: '2026-12-26', status: 'Done', budget: 25000 },
    { id: 't4', task: 'Sign squad-pass MoUs with DU + GGSIPU clubs; book buses from 6 metro hubs', campaign: 'B3', owner: 'Meera Iyer', deadline: '2027-01-02', status: 'Done', budget: 50000 },
    { id: 't5', task: 'Collect group rosters; chase leaders below 60% fill', campaign: 'B3', owner: 'Meera Iyer', deadline: '2027-01-16', status: 'In progress', budget: 0 },
    { id: 't6', task: 'Switch ambassador payout to ₹40 per verified attendee; weekly leaderboard', campaign: 'B4', owner: 'Meera Iyer', deadline: '2026-12-05', status: 'Done', budget: 33000 },
    { id: 't7', task: 'Cut paid/creator to brochure-downloader retargeting only; cap ₹40K', campaign: 'B5', owner: 'Nisha Rao', deadline: '2026-12-19', status: 'Done', budget: 40000 },
    { id: 't8', task: 'Auto-release waitlist seats on each cancellation', campaign: 'B1', owner: 'Arjun Verma', deadline: '2027-01-27', status: 'To do', budget: 0 },
  ];
}

// ---------- Metric engine ----------
const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
export const div = (a, b) => (b ? a / b : null);

function histProxy(bet) {
  const chs = HIST.channels.filter((c) => bet.proxy.includes(c.id));
  if (bet.overlay) {
    // B1 did not run in 2025: show cross-channel confirmed→attended baseline
    const confirmed = sum(HIST.channels, (c) => c.confirmed), attendees = sum(HIST.channels, (c) => c.attendees), regs = sum(HIST.channels, (c) => c.regs);
    return { budget: 0, spend: 0, reach: 0, identified: 0, regs, confirmed, attendees, notRun: true, optOutPct: null };
  }
  const m = { budget: sum(chs, (c) => c.spend), spend: sum(chs, (c) => c.spend), reach: sum(chs, (c) => c.reach), identified: sum(chs, (c) => c.identified), regs: sum(chs, (c) => c.regs), confirmed: sum(chs, (c) => c.confirmed), attendees: sum(chs, (c) => c.attendees), optOuts: sum(chs, (c) => c.optOuts) };
  m.optOutPct = +((m.optOuts / m.identified) * 100).toFixed(1);
  m.sources = chs.map((c) => c.name).join(' + ');
  return m;
}

function derive(m) {
  return { ...m, cac: m.notRun ? null : div(m.spend, m.attendees), cpr: div(m.spend, m.regs), regToAtt: div(m.attendees, m.regs), confRate: div(m.confirmed, m.regs), idToReg: div(m.regs, m.identified) };
}

function worst(a, b) { if (!a) return b; if (!b) return a; return STATUS_ORDER[a] >= STATUS_ORDER[b] ? a : b; }
const has = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v));

export function evalStatus(betId, m, weeksOut) {
  const R = []; // {rule, detail, verdict}
  let lead = null;
  const push = (verdict, rule, detail) => { R.push({ verdict, rule, detail }); lead = worst(lead, verdict); };
  if (betId === 'B1') {
    if (m.notRun) return { status: 'MONITOR', reasons: [{ verdict: 'MONITOR', rule: 'Not run in 2025', detail: `Baseline confirmed→attended ${pct(div(m.attendees, m.confirmed))} [DATA]; no lift data` }], basis: 'none' };
    if (has(m.liftPp) && has(m.optOutPct)) {
      if (m.liftPp < 2) push('CHANGE', 'Lift < 2 pp', `lift ${m.liftPp} pp`);
      if (m.optOutPct > 5) push('CHANGE', 'Opt-out > 5%', `opt-out ${m.optOutPct}%`);
      if (m.liftPp >= 5 && m.optOutPct < 2) push('SCALE', 'Lift ≥ 5 pp AND opt-out < 2%', `lift ${m.liftPp} pp, opt-out ${m.optOutPct}%`);
      if (!lead) push('MONITOR', 'Between thresholds', `lift ${m.liftPp} pp, opt-out ${m.optOutPct}%`);
    }
    return { status: lead || 'MONITOR', reasons: R, basis: 'leading' };
  }
  if (betId === 'B2' && has(m.k)) {
    if (m.k < 0.1 && (m.daysLive || 0) >= 14) push('STOP', 'k < 0.10 after ≥ 14 days', `k ${m.k}, ${m.daysLive} days live`);
    if (has(m.shareRatePct) && m.shareRatePct < 15) push('CHANGE', 'Share rate < 15%', `share rate ${m.shareRatePct}%`);
    if (m.k >= 0.3 && (m.inviteeShowPct || 0) >= 75) push('SCALE', 'k ≥ 0.30 AND invitee show ≥ 75%', `k ${m.k}, invitee show ${m.inviteeShowPct}%`);
    if (!lead) push('MONITOR', 'k between 0.10 and 0.30', `k ${m.k} (needs ≥ 0.30 to scale)`);
  }
  if (betId === 'B3' && has(m.mous)) {
    if (m.mous < 10 && weeksOut <= 6) push('STOP', '< 10 MoUs at ≤ T-6w', `${m.mous} MoUs at T-${weeksOut}w`);
    if (has(m.rosterFillPct) && m.rosterFillPct < 50 && weeksOut <= 4) push('CHANGE', 'Roster fill < 50% at ≤ T-4w', `fill ${m.rosterFillPct}%`);
    if (m.mous >= 25 && (m.rosterFillPct || 0) >= 70) push('SCALE', '≥ 25 MoUs AND fill ≥ 70%', `${m.mous} MoUs, fill ${m.rosterFillPct}%`);
    if (!lead) push('MONITOR', 'Between thresholds', `${m.mous} MoUs, fill ${m.rosterFillPct}%`);
  }
  if (betId === 'B4' && has(m.activePct)) {
    if (m.cpr != null && m.cpr > 200 && weeksOut <= 4) push('STOP', 'Cost/registration > ₹200 at ≤ T-4w', `CPR ${inr(m.cpr)}`);
    if (m.activePct < 50) push('CHANGE', 'Active ambassadors < 50%', `active ${m.activePct}%`);
    if ((m.topQRegsWk || 0) >= 15 && m.cpr != null && m.cpr <= 100) push('SCALE', 'Top-quartile ≥ 15/wk AND CPR ≤ ₹100', `top-Q ${m.topQRegsWk}/wk, CPR ${inr(m.cpr)}`);
    if (!lead) push('MONITOR', 'Between thresholds', `active ${m.activePct}%, CPR ${inr(m.cpr)}`);
  }
  if (betId === 'B5') {
    if (m.cpr != null && m.cpr > 180) push('STOP', 'Cost/registration > ₹180', `CPR ${inr(m.cpr)}`);
    if (has(m.optOutPct) && m.optOutPct > 8) push('STOP', 'Opt-out > 8%', `opt-out ${m.optOutPct}%`);
    if (m.cpr != null && m.cpr <= 110 && (m.confRate || 0) >= 0.88) push('SCALE', 'CPR ≤ ₹110 AND confirm ≥ 88%', `CPR ${inr(m.cpr)}, confirm ${pct(m.confRate)}`);
    if (!lead) push('MONITOR', 'Between thresholds', `CPR ${inr(m.cpr)}, confirm ${pct(m.confRate)}`);
  }
  // Economics guardrail for every acquisition line
  let econ = null;
  if (m.attendees > 0 && m.cac != null) {
    const e = (v, rule, d) => { R.push({ verdict: v, rule: 'Guardrail: ' + rule, detail: d }); econ = worst(econ, v); };
    const d = `CAC ${inr(m.cac)}, reg→attend ${pct(m.regToAtt)}`;
    if (m.cac > 180 || m.regToAtt < 0.55) e('STOP', 'CAC > ₹180 OR reg→attend < 55%', d);
    else if (m.cac > 150) e('CHANGE', 'CAC > ₹150', d);
    else if (m.cac <= 110 && m.regToAtt >= 0.75) e('SCALE', 'CAC ≤ ₹110 AND reg→attend ≥ 75%', d);
    else e('MONITOR', 'CAC ₹110–150 or reg→attend 55–75%', d);
  }
  const status = worst(lead, econ) || 'MONITOR';
  return { status, reasons: R, basis: lead ? 'leading + guardrail' : 'guardrail only (no leading-indicator data)' };
}

export function compute(mode, sim, tasks) {
  const isHist = mode === 'hist';
  const weeksOut = isHist ? 0 : Number(sim.weeksOut) || 0;
  const target = isHist ? HIST_TARGET : SCENARIOS[sim.scenario] || SCENARIOS.base;
  const campaigns = BETS.map((b) => {
    const raw = isHist ? histProxy(b) : { ...sim.campaigns[b.id] };
    const m = derive(raw);
    const st = evalStatus(b.id, m, weeksOut);
    const t = tasks.filter((x) => x.campaign === b.id);
    return { ...b, ...m, status: st.status, reasons: st.reasons, basis: st.basis, taskCount: t.length, openTasks: t.filter((x) => x.status !== 'Done').length, taskBudget: sum(t, (x) => x.budget) };
  });
  const acq = campaigns.filter((c) => !c.overlay);
  const walkIns = isHist ? HIST.walkIns : Number(sim.walkIns) || 0;
  const tot = {
    budget: isHist ? HIST_TARGET.budget : sum(campaigns, (c) => c.budget),
    spend: isHist ? sum(HIST.channels, (c) => c.spend) : sum(campaigns, (c) => c.spend),
    reach: isHist ? sum(HIST.channels, (c) => c.reach) : sum(acq, (c) => c.reach),
    identified: isHist ? sum(HIST.channels, (c) => c.identified) : sum(acq, (c) => c.identified),
    regs: isHist ? sum(HIST.channels, (c) => c.regs) : sum(acq, (c) => c.regs),
    confirmed: isHist ? sum(HIST.channels, (c) => c.confirmed) : sum(acq, (c) => c.confirmed),
    attendedReg: isHist ? sum(HIST.channels, (c) => c.attendees) : sum(acq, (c) => c.attendees),
    walkIns,
  };
  tot.total = tot.attendedReg + walkIns;
  tot.cap = target.budget;
  tot.regToAtt = div(tot.attendedReg, tot.regs);
  tot.cac = div(tot.spend, tot.total);
  tot.day1 = Math.round(tot.total * DAY1_SHARE);
  tot.capUtil = tot.day1 / CAP_DAY;
  tot.taskBudget = sum(tasks, (t) => t.budget);
  const waitlist = isHist ? sum(HIST.channels, (c) => c.waitlisted) : Number(sim.waitlist) || 0;
  const cancellations = isHist ? sum(HIST.channels, (c) => c.cancelled) : Number(sim.cancellations) || 0;

  // Funnel rows for chart
  const histTot = { reach: sum(HIST.channels, (c) => c.reach), identified: sum(HIST.channels, (c) => c.identified), regs: sum(HIST.channels, (c) => c.regs), confirmed: sum(HIST.channels, (c) => c.confirmed), attendedReg: sum(HIST.channels, (c) => c.attendees), total: HIST.uniqueAttendees };
  const stages = [['reach', 'Reach'], ['identified', 'Identified'], ['regs', 'Registered'], ['confirmed', 'Confirmed'], ['attendedReg', 'Attended (reg.)'], ['total', 'Total attendees']];
  const funnel = stages.map(([k, label]) => ({ stage: label, Target: target[k] ?? null, Actual: tot[k], Baseline: histTot[k] }));

  // Bottleneck detector
  const steps = [
    { step: 'Identified → Registered', from: tot.identified, to: tot.regs, tgt: div(target.regs, target.identified) },
    { step: 'Registered → Confirmed', from: tot.regs, to: tot.confirmed, tgt: div(target.confirmed, target.regs) },
    { step: 'Confirmed → Attended', from: tot.confirmed, to: tot.attendedReg, tgt: div(target.attendedReg, target.confirmed) },
  ].map((s) => ({ ...s, conv: div(s.to, s.from), lost: s.from - s.to }));
  const valid = steps.filter((s) => s.conv != null);
  const allPlanned = valid.every((s) => s.tgt != null);
  const steepest = [...valid].sort((a, b) => (allPlanned ? (a.conv - a.tgt) - (b.conv - b.tgt) : a.conv - b.conv))[0];
  steepest.basis = allPlanned ? 'largest gap vs plan' : 'lowest conversion';
  const lineCAC = isHist
    ? HIST.channels.map((c) => ({ name: c.name, cac: div(c.spend, c.attendees), optOutPct: (c.optOuts / c.identified) * 100, regToAtt: div(c.attendees, c.regs), attendees: c.attendees, spend: c.spend }))
    : acq.map((c) => ({ name: c.name, cac: c.cac, optOutPct: c.optOutPct ?? null, regToAtt: c.regToAtt, attendees: c.attendees, spend: c.spend, id: c.id }));
  const highestCAC = lineCAC.filter((c) => c.cac != null).sort((a, b) => b.cac - a.cac)[0];

  // Copilot alert rules
  const alerts = [];
  const projShare = div(tot.total, target.total);
  if (projShare != null && projShare < 0.95) alerts.push({ rule: 'R1', severity: 'high', text: `${isHist ? 'Actual' : 'Projected'} attendees ${fmt(tot.total)} = ${pct(projShare)} of target ${fmt(target.total)} (< 95%). Gap ${fmt(target.total - tot.total)}.` });
  lineCAC.forEach((c) => {
    const b = [];
    if (c.cac != null && c.cac > 150) b.push(`CAC ${inr(c.cac)} > ₹150`);
    if (c.optOutPct != null && c.optOutPct > 8) b.push(`opt-out ${c.optOutPct.toFixed(1)}% > 8%`);
    if (b.length) alerts.push({ rule: 'R2', severity: 'high', text: `${c.name}: ${b.join('; ')}.` });
  });
  const pace = pacingShare(weeksOut);
  const paceTarget = target.regs * pace;
  if (tot.regs < 0.9 * paceTarget) alerts.push({ rule: 'R3', severity: 'medium', text: `Registrations ${fmt(tot.regs)} = ${pct(tot.regs / paceTarget)} of pacing curve (${fmt(Math.round(paceTarget))} expected at T-${weeksOut}w).` });
  if (tot.day1 > 0.9 * CAP_DAY) alerts.push({ rule: 'R3', severity: 'high', text: `Projected Day-1 footfall ${fmt(tot.day1)} > 3,600 (90% of ${fmt(CAP_DAY)} cap). Sell Day-2-only passes.` });
  if (waitlist > 0 && cancellations > 0) alerts.push({ rule: 'R3', severity: 'medium', text: `${fmt(waitlist)} waitlisted while ${fmt(cancellations)} cancelled — release seats.` });

  return { mode, isHist, weeksOut, target, campaigns, tot, funnel, steps, steepest, lineCAC, highestCAC, alerts, pace, paceTarget, waitlist, cancellations };
}

// ---------- Formatting ----------
export const fmt = (n) => (n == null || Number.isNaN(n) ? '—' : Math.round(n).toLocaleString('en-IN'));
export const inr = (n) => (n == null || Number.isNaN(n) || !Number.isFinite(n) ? '—' : '₹' + Math.round(n).toLocaleString('en-IN'));
export const pct = (r, d = 1) => (r == null || Number.isNaN(r) || !Number.isFinite(r) ? '—' : (r * 100).toFixed(d) + '%');
export const inrK = (n) => (n == null ? '—' : '₹' + (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'K');

export function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
export const simToday = (weeksOut) => addDays(EVENT_DATE, -7 * (Number(weeksOut) || 0));

// ---------- Exports ----------
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export function toCSV(view, tasks) {
  const head = ['id', 'name', 'status', 'budget_inr', 'spend_inr', 'reach', 'identified', 'registrations', 'confirmed', 'attendees', 'cac_inr', 'reg_to_attend_pct', 'cost_per_reg_inr'];
  const rows = view.campaigns.map((c) => [c.id, c.name, c.status, c.budget, c.spend, c.reach, c.identified, c.regs, c.confirmed, c.attendees, c.cac == null ? '' : Math.round(c.cac), c.regToAtt == null ? '' : (c.regToAtt * 100).toFixed(1), c.cpr == null ? '' : Math.round(c.cpr)]);
  const t = ['id', 'task', 'campaign', 'owner', 'deadline', 'status', 'budget_inr'];
  const tr = tasks.map((x) => [x.id, x.task, x.campaign, x.owner, x.deadline, x.status, x.budget]);
  return ['# campaigns (' + (view.isHist ? 'historical baseline' : 'active simulation') + ')', head.join(','), ...rows.map((r) => r.map(csvCell).join(',')), '', '# tasks', t.join(','), ...tr.map((r) => r.map(csvCell).join(','))].join('\n');
}
