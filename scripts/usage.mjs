#!/usr/bin/env node
/**
 * Claude Code Usage — terminal viewer
 * Inspired by ccusage (github.com/ccusage/ccusage)
 *
 * Subcommands: daily (default) | weekly | monthly | session | blocks
 *
 * Options:
 *   --since YYYY-MM-DD   Start date (inclusive)
 *   --until YYYY-MM-DD   End date (inclusive)
 *   --days N             Last N periods
 *   --today              Today only
 *   --breakdown          Show per-model rows
 *   --no-cost            Hide cost column
 *   --compact            Force compact layout
 *   --json               JSON output (stdout)
 *   --watch              Live-refresh mode (re-renders every N seconds)
 *   --interval N         Refresh interval in seconds (default 5, use with --watch)
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { homedir } from 'os';

// ── ANSI ──────────────────────────────────────────────────────────────────────
const R  = '\x1b[0m';
const b  = s => `\x1b[1m${s}${R}`;
const d  = s => `\x1b[2m${s}${R}`;
const cy = s => `\x1b[36m${s}${R}`;
const gr = s => `\x1b[32m${s}${R}`;
const yw = s => `\x1b[33m${s}${R}`;
const pu = s => `\x1b[35m${s}${R}`;
const bl = s => `\x1b[34m${s}${R}`;
const re = s => `\x1b[31m${s}${R}`;
const gy = s => `\x1b[90m${s}${R}`;

function stripAnsi(s) { return s.replace(/\x1b\[[0-9;]*m/g, ''); }
function pad(s, n, right = false) {
  const len = stripAnsi(s).length;
  const p = ' '.repeat(Math.max(0, n - len));
  return right ? p + s : s + p;
}

// ── Pricing  (approx mid-2026, per 1M tokens) ─────────────────────────────────
const PRICING = [
  { match: 'opus',   input: 15.00, output: 75.00, cache_read: 1.50,  cache_write: 18.75 },
  { match: 'sonnet', input:  3.00, output: 15.00, cache_read: 0.30,  cache_write:  3.75 },
  { match: 'haiku',  input:  0.80, output:  4.00, cache_read: 0.08,  cache_write:  1.00 },
  { match: '',       input:  3.00, output: 15.00, cache_read: 0.30,  cache_write:  3.75 }, // fallback
];

function getPrice(model) {
  return PRICING.find(p => p.match && model.includes(p.match)) ?? PRICING[PRICING.length - 1];
}

function calcCost(s, model) {
  const p = getPrice(model ?? '');
  return (
    (s.input       / 1e6) * p.input +
    (s.output      / 1e6) * p.output +
    (s.cache_read  / 1e6) * p.cache_read +
    (s.cache_write / 1e6) * p.cache_write
  );
}

// ── Formatting ────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtCost(usd) {
  if (usd >= 100) return `$${usd.toFixed(0)}`;
  if (usd >= 1)   return `$${usd.toFixed(2)}`;
  return `¢${(usd * 100).toFixed(1)}`;
}

function modelTag(model) {
  if (model.includes('opus'))   return pu('Opus');
  if (model.includes('sonnet')) return bl('Sonnet');
  if (model.includes('haiku'))  return gr('Haiku');
  return cy(model.length > 8 ? model.slice(0, 8) : model);
}

// ── Args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const SUBCMDS = ['daily', 'weekly', 'monthly', 'session', 'blocks'];
const subcmd = SUBCMDS.find(c => argv.includes(c)) ?? 'daily';

function getArg(flag, def = null) {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] ?? def : def;
}
const hasFlag = f => argv.includes(f);

const OPT = {
  since:     getArg('--since'),
  until:     getArg('--until'),
  days:      getArg('--days') ? parseInt(getArg('--days'), 10) : null,
  today:     hasFlag('--today'),
  breakdown: hasFlag('--breakdown'),
  noCost:    hasFlag('--no-cost'),
  compact:   hasFlag('--compact'),
  json:      hasFlag('--json'),
  watch:     hasFlag('--watch'),
  interval:  getArg('--interval') ? parseInt(getArg('--interval'), 10) : 60,
};

const termWidth = process.stdout.columns || 120;
const isCompact = OPT.compact || termWidth < 100;

// ── ZERO stats ─────────────────────────────────────────────────────────────────
const zero = () => ({ input: 0, output: 0, cache_read: 0, cache_write: 0, requests: 0 });
const addStats = (a, b) => ({
  input:       a.input       + b.input,
  output:      a.output      + b.output,
  cache_read:  a.cache_read  + b.cache_read,
  cache_write: a.cache_write + b.cache_write,
  requests:    a.requests    + b.requests,
});
const totalTok = s => s.input + s.output + s.cache_read + s.cache_write;

// ── Parse JSONL ───────────────────────────────────────────────────────────────
async function parseFile(filePath) {
  const results = [];
  const seen = new Set();
  let rl;
  try {
    rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  } catch { return results; }
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      const msg = entry?.message;
      if (!msg?.usage || !msg?.model || !entry?.timestamp) continue;
      if (msg.id && seen.has(msg.id)) continue;
      if (msg.id) seen.add(msg.id);
      results.push({
        ts:      entry.timestamp,
        model:   msg.model,
        session: path.basename(filePath, '.jsonl'),
        project: path.basename(path.dirname(filePath)),
        input:       msg.usage.input_tokens              ?? 0,
        output:      msg.usage.output_tokens             ?? 0,
        cache_read:  msg.usage.cache_read_input_tokens   ?? 0,
        cache_write: msg.usage.cache_creation_input_tokens ?? 0,
      });
    } catch { /* skip */ }
  }
  return results;
}

async function loadAll() {
  const projectsDir = path.join(homedir(), '.claude/projects');
  if (!fs.existsSync(projectsDir)) return [];
  const all = [];
  for (const dir of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const pp = path.join(projectsDir, dir.name);
    for (const file of fs.readdirSync(pp).filter(f => f.endsWith('.jsonl'))) {
      const entries = await parseFile(path.join(pp, file));
      all.push(...entries);
    }
  }
  return all.sort((a, b) => a.ts.localeCompare(b.ts));
}

// ── Date helpers ──────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);

function toDate(ts) { return ts.slice(0, 10); }
function toWeek(ts) {
  const d = new Date(ts);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yr = d.getUTCFullYear();
  const wk = Math.ceil(((d - new Date(Date.UTC(yr, 0, 1))) / 86400000 + 1) / 7);
  return `${yr}-W${String(wk).padStart(2, '0')}`;
}
function toMonth(ts) { return ts.slice(0, 7); }

function inRange(date) {
  if (OPT.today  && date !== today) return false;
  if (OPT.since  && date < OPT.since) return false;
  if (OPT.until  && date > OPT.until) return false;
  return true;
}

// ── Current session ───────────────────────────────────────────────────────────
async function getCurrentSession(projectsDir) {
  let newest = null;
  for (const dir of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const pp = path.join(projectsDir, dir.name);
    for (const file of fs.readdirSync(pp).filter(f => f.endsWith('.jsonl'))) {
      const fp = path.join(pp, file);
      const mtime = fs.statSync(fp).mtimeMs;
      if (!newest || mtime > newest.mtime) {
        newest = { fp, mtime, session: path.basename(file, '.jsonl'), project: dir.name };
      }
    }
  }
  if (!newest) return null;
  const entries = await parseFile(newest.fp);
  if (entries.length === 0) return null;
  const models = new Map();
  for (const e of entries) {
    const s = models.get(e.model) ?? zero();
    s.input       += e.input;
    s.output      += e.output;
    s.cache_read  += e.cache_read;
    s.cache_write += e.cache_write;
    s.requests    += 1;
    models.set(e.model, s);
  }
  const totals = [...models.values()].reduce(addStats, zero());
  const cost = [...models.entries()].reduce((a, [m, s]) => a + calcCost(s, m), 0);
  const firstTs = entries[0].ts;
  const lastTs  = entries[entries.length - 1].ts;
  return { session: newest.session, project: newest.project, firstTs, lastTs, models, totals, cost };
}

function progressBar(ratio, width = 28) {
  const filled = Math.round(Math.min(1, Math.max(0, ratio)) * width);
  const empty  = width - filled;
  const pct    = Math.round(ratio * 100);
  const BAR_FILL  = '█';
  const BAR_EMPTY = '░';

  let bar;
  if (pct >= 90)      bar = re(BAR_FILL.repeat(filled)) + gy(BAR_EMPTY.repeat(empty));
  else if (pct >= 70) bar = yw(BAR_FILL.repeat(filled)) + gy(BAR_EMPTY.repeat(empty));
  else                bar = gr(BAR_FILL.repeat(filled)) + gy(BAR_EMPTY.repeat(empty));

  return `${gy('[')}${bar}${gy(']')} ${String(pct).padStart(3)}%`;
}

function fmtDuration(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function printCurrentSession(sess) {
  const W   = termWidth - 2;
  const div = gy('─'.repeat(W));
  console.log();
  console.log(b('  CURRENT SESSION') + gy('  ' + '─'.repeat(Math.max(0, W - 20))));
  if (!sess) { console.log(gy('  No session data found.')); return; }

  const BLOCK_MS   = 5 * 60 * 60 * 1000; // 5 hours
  const startedAt  = new Date(sess.firstTs).getTime();
  const resetAt    = startedAt + BLOCK_MS;
  const now        = Date.now();
  const elapsedMs  = now - startedAt;
  const remainMs   = Math.max(0, resetAt - now);
  const ratio      = Math.min(1, elapsedMs / BLOCK_MS);
  const isExpired  = now >= resetAt;

  const shortId = sess.session.slice(0, 24) + '…';
  const elStr   = fmtDuration(elapsedMs);
  console.log(`  ${gy('Session')} ${cy(shortId)}  ${gy('started')} ${bl(elStr + ' ago')}`);
  console.log();

  // ── 5-hour block progress bar ─────────────────────────────────────────────
  const barLine = `  ${progressBar(ratio)}`;
  if (isExpired) {
    console.log(barLine + '  ' + gr('✓ block reset — new window started'));
  } else {
    const label = ratio >= 0.9
      ? re(`⚠ resets in ${fmtDuration(remainMs)}`)
      : gy(`resets in ${fmtDuration(remainMs)}`);
    console.log(barLine + '  ' + label + gy('  (5h billing window)'));
  }
  console.log();

  // ── Per-model stats ───────────────────────────────────────────────────────
  for (const [model, s] of sess.models.entries()) {
    const cost = calcCost(s, model);
    const parts = [
      `    ${modelTag(model)}`,
      `↑ ${b(fmt(s.input))} in`,
      `↓ ${b(fmt(s.output))} out`,
      gr(`⚡ ${fmt(s.cache_read)} cached`),
      yw(`+ ${fmt(s.cache_write)} written`),
      `${b(String(s.requests))} req`,
    ];
    if (!OPT.noCost) parts.push(b(cy(fmtCost(cost))));
    console.log(parts.join('  '));
  }

  // ── Total row ─────────────────────────────────────────────────────────────
  const grandParts = [
    `    ${gy('TOTAL')}`,
    `↑ ${b(fmt(sess.totals.input))} in`,
    `↓ ${b(fmt(sess.totals.output))} out`,
    gr(`⚡ ${fmt(sess.totals.cache_read)} cached`),
    yw(`+ ${fmt(sess.totals.cache_write)} written`),
    `${b(String(sess.totals.requests))} req`,
  ];
  if (!OPT.noCost) grandParts.push(b(cy(fmtCost(sess.cost))));
  console.log(div);
  console.log(grandParts.join('  '));
}

// ── Aggregation ────────────────────────────────────────────────────────────────
function aggregate(entries, keyFn) {
  // Map<key, Map<model, stats>>
  const map = new Map();
  for (const e of entries) {
    const date = toDate(e.ts);
    if (!inRange(date)) continue;
    const key = keyFn(e.ts);
    if (!map.has(key)) map.set(key, new Map());
    const models = map.get(key);
    const s = models.get(e.model) ?? zero();
    s.input       += e.input;
    s.output      += e.output;
    s.cache_read  += e.cache_read;
    s.cache_write += e.cache_write;
    s.requests    += 1;
    models.set(e.model, s);
  }
  // Convert to sorted array
  let rows = [...map.entries()].map(([key, models]) => {
    const totals = [...models.values()].reduce(addStats, zero());
    const cost = [...models.entries()].reduce((acc, [m, s]) => acc + calcCost(s, m), 0);
    return { key, models: [...models.entries()].sort((a, b) => b[1].input - a[1].input), totals, cost };
  });
  rows.sort((a, b) => b.key.localeCompare(a.key));
  if (OPT.days) rows = rows.slice(0, OPT.days);
  return rows;
}

function aggregateSessions(entries) {
  const map = new Map();
  for (const e of entries) {
    const date = toDate(e.ts);
    if (!inRange(date)) continue;
    const key = e.session;
    if (!map.has(key)) map.set(key, { session: e.session, project: e.project, date, models: new Map(), firstTs: e.ts, lastTs: e.ts });
    const rec = map.get(key);
    if (e.ts < rec.firstTs) rec.firstTs = e.ts;
    if (e.ts > rec.lastTs)  rec.lastTs  = e.ts;
    const s = rec.models.get(e.model) ?? zero();
    s.input       += e.input;
    s.output      += e.output;
    s.cache_read  += e.cache_read;
    s.cache_write += e.cache_write;
    s.requests    += 1;
    rec.models.set(e.model, s);
  }
  let rows = [...map.values()].map(rec => {
    const totals = [...rec.models.values()].reduce(addStats, zero());
    const cost = [...rec.models.entries()].reduce((acc, [m, s]) => acc + calcCost(s, m), 0);
    return { ...rec, models: [...rec.models.entries()], totals, cost };
  });
  rows.sort((a, b) => b.firstTs.localeCompare(a.firstTs));
  if (OPT.days) rows = rows.slice(0, OPT.days);
  return rows;
}

// ── 5-hour billing blocks ─────────────────────────────────────────────────────
function aggregateBlocks(entries) {
  // Each block is a 5-hour window starting at first request time in that window
  const BLOCK_MS = 5 * 60 * 60 * 1000;
  const blocks = [];
  let curBlock = null;

  for (const e of entries) {
    const date = toDate(e.ts);
    if (!inRange(date)) continue;
    const t = new Date(e.ts).getTime();
    if (!curBlock || t >= curBlock.end) {
      curBlock = { start: t, end: t + BLOCK_MS, startTs: e.ts, models: new Map() };
      blocks.push(curBlock);
    }
    const s = curBlock.models.get(e.model) ?? zero();
    s.input       += e.input;
    s.output      += e.output;
    s.cache_read  += e.cache_read;
    s.cache_write += e.cache_write;
    s.requests    += 1;
    curBlock.models.set(e.model, s);
  }

  let rows = blocks.map(bl => {
    const totals = [...bl.models.values()].reduce(addStats, zero());
    const cost = [...bl.models.entries()].reduce((acc, [m, s]) => acc + calcCost(s, m), 0);
    const startDate = new Date(bl.start);
    const endDate   = new Date(bl.end);
    const fmt2 = d => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const isActive = Date.now() < bl.end;
    return {
      key:     bl.startTs.slice(0, 10) + ' ' + fmt2(startDate) + '–' + fmt2(endDate),
      models:  [...bl.models.entries()],
      totals, cost, isActive,
      startMs: bl.start, endMs: bl.end,
    };
  }).reverse();

  if (OPT.days) rows = rows.slice(0, OPT.days);
  return rows;
}

// ── Table rendering ────────────────────────────────────────────────────────────
const BOX = {
  tl: '┌', tr: '┐', bl: '└', br: '┘',
  h: '─', v: '│', tee_d: '┬', tee_u: '┴', tee_r: '├', tee_l: '┤', cross: '┼',
};

function hline(widths, left, mid, right, char = BOX.h) {
  return left + widths.map(w => char.repeat(w + 2)).join(mid) + right;
}

function tableRow(cells, widths, colors = []) {
  return BOX.v + cells.map((c, i) => {
    const colored = colors[i] ? colors[i](c) : c;
    return ' ' + pad(colored, widths[i]) + ' ';
  }).join(BOX.v) + BOX.v;
}

function renderTable(headers, rows, colColors = []) {
  const widths = headers.map((h, i) => {
    return Math.max(
      stripAnsi(h).length,
      ...rows.map(r => stripAnsi(String(r[i] ?? '')).length)
    );
  });

  const lines = [];
  lines.push(hline(widths, BOX.tl, BOX.tee_d, BOX.tr));
  lines.push(tableRow(headers, widths, headers.map(() => b)));
  lines.push(hline(widths, BOX.tee_r, BOX.cross, BOX.tee_l));
  for (const row of rows) {
    lines.push(tableRow(row.map(String), widths, colColors));
  }
  lines.push(hline(widths, BOX.bl, BOX.tee_u, BOX.br));
  return lines.join('\n');
}

// ── Report builders ────────────────────────────────────────────────────────────
function buildPeriodicReport(rows, label, sess = null) {
  const grand = rows.reduce((acc, r) => ({
    ...addStats(acc, r.totals),
    cost: acc.cost + r.cost,
  }), { ...zero(), cost: 0 });

  if (OPT.json) {
    const out = {
      period: label,
      generated: new Date().toISOString(),
      totals: { ...grand, total_tokens: totalTok(grand) },
      rows: rows.map(r => ({
        key: r.key,
        totals: { ...r.totals, total_tokens: totalTok(r.totals) },
        cost: OPT.noCost ? undefined : r.cost,
        models: r.models.map(([model, s]) => ({
          model, ...s, total_tokens: totalTok(s),
          cost: OPT.noCost ? undefined : calcCost(s, model),
        })),
      })),
    };
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  const W = termWidth - 2;

  // ── Header ──────────────────────────────────────────────────────────────────
  console.log();
  console.log(b(cy(` ◆ Claude Code — ${label} Report`)));
  const filterParts = [];
  if (OPT.today)  filterParts.push('today');
  if (OPT.since)  filterParts.push(`since ${OPT.since}`);
  if (OPT.until)  filterParts.push(`until ${OPT.until}`);
  if (OPT.days)   filterParts.push(`last ${OPT.days}`);
  if (filterParts.length) console.log(d(`  Filter: ${filterParts.join(', ')}`));
  console.log(d(`  Pricing: approximate mid-2026 rates · ${yw('costs are estimates')}`));
  console.log();

  // ── Summary banner ──────────────────────────────────────────────────────────
  const bannerParts = [
    `↑ ${b(fmt(grand.input))}`,
    `↓ ${b(fmt(grand.output))}`,
    gr(`⚡ ${fmt(grand.cache_read)} cached`),
    yw(`+ ${fmt(grand.cache_write)} written`),
    `${b(fmt(grand.requests))} req`,
  ];
  if (!OPT.noCost) bannerParts.push(b(cy(fmtCost(grand.cost))));
  console.log(gy('  ') + bannerParts.join(gy('  ·  ')));
  console.log();

  // ── Per-model breakdown (TOP) ───────────────────────────────────────────────
  if (OPT.breakdown && rows.length > 0) {
    console.log(b('  PER-MODEL BREAKDOWN') + gy('  ' + '─'.repeat(Math.max(0, W - 22))));
    for (const row of rows) {
      if (row.models.length === 0) continue;
      const isToday = row.key === today;
      console.log();
      console.log(`  ${b(row.key)}${isToday ? d(' (today)') : ''}`);
      for (const [model, s] of row.models) {
        const cost = calcCost(s, model);
        const parts = [
          `    ${modelTag(model)}`,
          gy('↑') + ` ${fmt(s.input).padStart(8)}`,
          gy('↓') + ` ${fmt(s.output).padStart(8)}`,
          gr('⚡') + ` ${fmt(s.cache_read).padStart(8)}`,
          yw('+') + ` ${fmt(s.cache_write).padStart(8)}`,
          `${s.requests} req`,
        ];
        if (!OPT.noCost) parts.push(cy(fmtCost(cost)));
        console.log(parts.join('  '));
      }
    }
    console.log();
  }

  // ── Per-period table (MIDDLE) ────────────────────────────────────────────────
  const periodCol = label === 'Daily' ? 'Date' : label === 'Weekly' ? 'Week' : 'Period';
  const headers = isCompact
    ? [periodCol, 'Tokens', 'Req']
    : [periodCol, 'Input', 'Output', 'Cached ⚡', 'Written +', 'Req', 'Total'];
  if (!OPT.noCost) headers.push('Cost');

  const tableRows = rows.map(r => {
    const isToday = r.key === today;
    const keyLabel = isToday ? `${r.key} ←today` : r.key;
    if (isCompact) {
      const row = [keyLabel, fmt(totalTok(r.totals)), String(r.totals.requests)];
      if (!OPT.noCost) row.push(fmtCost(r.cost));
      return row;
    }
    const row = [
      keyLabel,
      fmt(r.totals.input),
      fmt(r.totals.output),
      fmt(r.totals.cache_read),
      fmt(r.totals.cache_write),
      String(r.totals.requests),
      fmt(totalTok(r.totals)),
    ];
    if (!OPT.noCost) row.push(fmtCost(r.cost));
    return row;
  });

  console.log(renderTable(headers, tableRows));

  // ── Current session (BOTTOM) ─────────────────────────────────────────────────
  if (sess) printCurrentSession(sess);
  console.log();
}

function buildSessionReport(rows, sess = null) {
  if (OPT.json) {
    console.log(JSON.stringify(rows.map(r => ({
      session: r.session, project: r.project, date: r.date,
      first: r.firstTs, last: r.lastTs,
      totals: { ...r.totals, total_tokens: totalTok(r.totals) },
      cost: OPT.noCost ? undefined : r.cost,
    })), null, 2));
    return;
  }

  console.log();
  console.log(b(cy(' ◆ Claude Code — Session Report')));
  console.log(d('  Each row = one conversation/session'));
  console.log();

  // ── Sessions table (TOP) ────────────────────────────────────────────────────
  const headers = ['Date', 'Session ID', 'Input', 'Output', 'Cached ⚡', 'Req', 'Total'];
  if (!OPT.noCost) headers.push('Cost');

  const tableRows = rows.map(r => {
    const isActive = sess && r.session === sess.session;
    const dateLbl = r.date === today ? `${r.date} ←today` : r.date;
    const sessLbl = (isActive ? gr('● ') : '  ') + r.session.slice(0, 16);
    const row = [
      dateLbl, sessLbl,
      fmt(r.totals.input), fmt(r.totals.output),
      fmt(r.totals.cache_read), String(r.totals.requests),
      fmt(totalTok(r.totals)),
    ];
    if (!OPT.noCost) row.push(fmtCost(r.cost));
    return row;
  });

  console.log(renderTable(headers, tableRows));
  if (sess) console.log(d(`  ${gr('●')} = current session`));

  // ── Current session detail (BOTTOM) ────────────────────────────────────────
  if (sess) printCurrentSession(sess);
  console.log();
}

function buildBlocksReport(rows) {
  if (OPT.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  console.log();
  console.log(b(cy(' ◆ Claude Code — 5-Hour Billing Blocks')));
  console.log(d('  Each block = 5-hour window from first request'));
  console.log();

  const headers = ['Block (start → end)', 'Tokens', 'Input', 'Output', 'Cached', 'Req'];
  if (!OPT.noCost) headers.push('Cost');

  const tableRows = rows.map(r => {
    const active = r.isActive ? gr(' ●') : '';
    const row = [
      r.key + active,
      fmt(totalTok(r.totals)),
      fmt(r.totals.input),
      fmt(r.totals.output),
      fmt(r.totals.cache_read),
      String(r.totals.requests),
    ];
    if (!OPT.noCost) row.push(fmtCost(r.cost));
    return row;
  });

  console.log(renderTable(headers, tableRows));
  if (rows.some(r => r.isActive)) console.log(d(`  ${gr('●')} = active block`));
  console.log();
}

// ── Entry ─────────────────────────────────────────────────────────────────────
async function render() {
  const projectsDir = path.join(homedir(), '.claude/projects');

  if (OPT.watch) {
    process.stdout.write('\x1b[2J\x1b[H'); // clear screen, move to top
  }

  const [entries, sess] = await Promise.all([
    loadAll(),
    getCurrentSession(projectsDir),
  ]);

  if (entries.length === 0) {
    console.log(yw('No usage data found.'));
    return;
  }

  switch (subcmd) {
    case 'daily':   buildPeriodicReport(aggregate(entries, toDate),  'Daily',   sess); break;
    case 'weekly':  buildPeriodicReport(aggregate(entries, toWeek),  'Weekly',  sess); break;
    case 'monthly': buildPeriodicReport(aggregate(entries, toMonth), 'Monthly', sess); break;
    case 'session': buildSessionReport(aggregateSessions(entries), sess);              break;
    case 'blocks':  buildBlocksReport(aggregateBlocks(entries));                       break;
  }

  if (OPT.watch) {
    const now = new Date().toLocaleTimeString();
    process.stdout.write(
      gy(`  Last updated: ${now} · refreshing every ${OPT.interval}s · `) +
      re('Ctrl+C to quit') + '\n'
    );
  }
}

async function main() {
  const projectsDir = path.join(homedir(), '.claude/projects');
  if (!fs.existsSync(projectsDir)) {
    console.error(re(`✗ No Claude projects dir at ${projectsDir}`));
    process.exit(1);
  }

  await render();


  if (OPT.watch && !OPT.json) {
    const ms = OPT.interval * 1000;
    const loop = setInterval(async () => {
      try { await render(); } catch (err) { console.error(re(`✗ ${err.message}`)); }
    }, ms);
    // Keep process alive; Ctrl+C exits cleanly
    process.on('SIGINT', () => { clearInterval(loop); process.exit(0); });
  }
}

main().catch(err => {
  console.error(re(`✗ ${err.message}`));
  process.exit(1);
});
