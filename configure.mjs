#!/usr/bin/env node
// Configure the "grok-search" MCP server (grok-search-rs -> CLIProxyAPI) into
// Claude Code, Codex, and opencode. Cross-platform, idempotent, secret-safe.
//
// Reads config from env (set by install.sh / install.ps1):
//   GROK_CPA_KEY   (required unless GROK_UNINSTALL)  API key for your endpoint
//   GROK_URL       default https://api.x.ai/v1  (set to YOUR CLIProxyAPI/proxy endpoint)
//   GROK_MODEL     default grok-4.5
//   GROK_TIMEOUT   default 150   (the load-bearing fix: CPA grok search takes ~50s)
//   GROK_X_SEARCH  default true
//   GROK_UNINSTALL if set, remove the config instead of adding it
//   GROK_FORCE_INSTALL if set, reinstall the npm binary even when present
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const NAME = 'grok-search';
const isWin = process.platform === 'win32';
const env = process.env;
const REPO = (env.GROK_SETUP_REPO || 'https://raw.githubusercontent.com/gith-ship-it/grok-search-setup/main').replace(/\/+$/, '');

const KEY = (env.GROK_CPA_KEY || '').trim();
const URL = (env.GROK_URL || 'https://api.x.ai/v1').trim().replace(/\/+$/, '');
const MODEL = (env.GROK_MODEL || 'grok-4.5').trim();
const TIMEOUT = (env.GROK_TIMEOUT || '150').trim();
const XSEARCH = (env.GROK_X_SEARCH || 'true').trim();
const UNINSTALL = !!env.GROK_UNINSTALL;

const home = os.homedir();
const keyDir = path.join(home, '.config', 'grok-search-rs');
const keyFile = path.join(keyDir, 'cpa.key');

// MCP clients on Windows must launch the .cmd shim through cmd.exe.
const launch = isWin ? ['cmd', '/c', 'grok-search-rs'] : ['grok-search-rs'];

// Non-secret env every client gets. The API key is added per-client (inline for
// Claude/Codex, {file:} reference for opencode) so it never lands in a shared file.
const envPairs = [
  ['GROK_SEARCH_URL', URL],
  ['GROK_SEARCH_MODEL', MODEL],
  ['GROK_SEARCH_WEB_SEARCH', 'true'],
  ['GROK_SEARCH_X_SEARCH', XSEARCH],
  ['GROK_SEARCH_TIMEOUT_SECONDS', TIMEOUT],
];

const log = (...a) => console.log('[grok-setup]', ...a);
const warn = (...a) => console.warn('[grok-setup] !', ...a);

function have(cmd) {
  const r = isWin
    ? spawnSync('where', [cmd], { stdio: 'ignore' })
    : spawnSync('sh', ['-c', `command -v "${cmd}"`], { stdio: 'ignore' });
  return r.status === 0;
}

// Client CLIs are .cmd shims on Windows -> need a shell there. All argument
// values are validated safe tokens (see key check), so shell use is safe.
function runClient(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8', shell: isWin });
}

function installBinary() {
  if (have('grok-search-rs') && !env.GROK_FORCE_INSTALL) {
    log('grok-search-rs already installed - skipping npm (GROK_FORCE_INSTALL=1 to reinstall)');
    return;
  }
  log('installing grok-search-rs (npm install -g)...');
  const r = spawnSync('npm', ['install', '-g', 'grok-search-rs'], { stdio: 'inherit', shell: true });
  if (r.status !== 0) throw new Error('npm install -g grok-search-rs failed');
}

function writeKeyFile() {
  fs.mkdirSync(keyDir, { recursive: true });
  fs.writeFileSync(keyFile, KEY, { mode: 0o600 });
  try { fs.chmodSync(keyFile, 0o600); } catch { /* no-op on Windows */ }
  log('wrote key ->', keyFile, '(chmod 600)');
}

function configClaude() {
  if (!have('claude')) { log('Claude Code CLI not found - skipping'); return; }
  runClient('claude', ['mcp', 'remove', NAME, '-s', 'user']); // idempotent; ignore result
  const args = ['mcp', 'add', NAME, '-s', 'user'];
  for (const [k, v] of envPairs) args.push('-e', `${k}=${v}`);
  args.push('-e', `GROK_SEARCH_API_KEY=${KEY}`);
  args.push('--', ...launch);
  const r = runClient('claude', args);
  if (r.status === 0) log('OK Claude Code configured (user scope)');
  else warn('Claude Code config failed:', (r.stderr || r.stdout || '').trim().slice(0, 300));
}

function configCodex() {
  if (!have('codex')) { log('Codex CLI not found - skipping'); return; }
  runClient('codex', ['mcp', 'remove', NAME]); // idempotent
  const args = ['mcp', 'add', NAME];
  for (const [k, v] of envPairs) args.push('--env', `${k}=${v}`);
  args.push('--env', `GROK_SEARCH_API_KEY=${KEY}`);
  args.push('--', ...launch);
  const r = runClient('codex', args);
  if (r.status === 0) log('OK Codex configured');
  else warn('Codex config failed:', (r.stderr || r.stdout || '').trim().slice(0, 300));
}

function configOpencode() {
  const cfgDir = path.join(home, '.config', 'opencode');
  const cfg = path.join(cfgDir, 'opencode.json');
  const exists = fs.existsSync(cfg);
  if (!have('opencode') && !exists) { log('opencode not found - skipping'); return; }

  let obj = {};
  if (exists) {
    try { obj = JSON.parse(fs.readFileSync(cfg, 'utf8')); }
    catch (e) { warn('opencode.json is not valid JSON - skipping to avoid clobbering:', e.message); return; }
  } else {
    fs.mkdirSync(cfgDir, { recursive: true });
    obj.$schema = 'https://opencode.ai/config.json';
  }
  obj.mcp = obj.mcp || {};
  const environment = Object.fromEntries(envPairs);
  // opencode interpolates {file:...} at load time, so the key stays out of opencode.json.
  environment.GROK_SEARCH_API_KEY = `{file:${keyFile}}`;
  obj.mcp[NAME] = { type: 'local', command: launch, environment, enabled: true };
  fs.writeFileSync(cfg, JSON.stringify(obj, null, 2) + '\n');
  log('OK opencode configured ->', cfg);
}

// Claude Code auto-invokes tools better with a skill: its trigger description is
// always in context, telling the agent WHEN to reach for grok-search (same
// pattern Firecrawl uses for its official skill).
const skillDir = path.join(home, '.claude', 'skills', NAME);

async function configSkill() {
  if (!have('claude') && !fs.existsSync(path.join(home, '.claude'))) {
    log('Claude Code not found - skipping skill install');
    return;
  }
  try {
    const r = await fetch(`${REPO}/skills/grok-search/SKILL.md`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const md = await r.text();
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), md);
    log('OK Claude Code skill installed ->', path.join(skillDir, 'SKILL.md'));
  } catch (e) {
    warn('skill install skipped (fetch failed):', e.message);
  }
}

async function verify() {
  try {
    const r = await fetch(`${URL}/models`, {
      headers: { Authorization: `Bearer ${KEY}`, 'User-Agent': 'Mozilla/5.0' },
    });
    if (r.ok) {
      const j = await r.json().catch(() => ({}));
      log(`OK CPA reachable at ${URL} (${(j.data || []).length} models, key valid)`);
    } else {
      warn(`CPA returned HTTP ${r.status} at ${URL} - check key / URL / Cloudflare bot-protection. Config was still written.`);
    }
  } catch (e) {
    warn('CPA connectivity check failed:', e.message, '- config was still written.');
  }
}

function uninstall() {
  if (have('claude')) runClient('claude', ['mcp', 'remove', NAME, '-s', 'user']);
  if (have('codex')) runClient('codex', ['mcp', 'remove', NAME]);
  const cfg = path.join(home, '.config', 'opencode', 'opencode.json');
  if (fs.existsSync(cfg)) {
    try {
      const o = JSON.parse(fs.readFileSync(cfg, 'utf8'));
      if (o.mcp && o.mcp[NAME]) { delete o.mcp[NAME]; fs.writeFileSync(cfg, JSON.stringify(o, null, 2) + '\n'); }
    } catch { /* leave as-is */ }
  }
  try { fs.rmSync(keyFile); } catch { /* already gone */ }
  try { fs.rmSync(skillDir, { recursive: true, force: true }); } catch { /* already gone */ }
  log('removed grok-search MCP config from all clients + deleted key file.');
  log('binary left in place. Run: npm uninstall -g grok-search-rs   to remove it.');
}

async function main() {
  if (UNINSTALL) { uninstall(); return; }
  if (!KEY) { console.error('[grok-setup] ERROR: no CPA key (set GROK_CPA_KEY / CPA_KEY).'); process.exit(1); }
  if (!/^[\w.\-]+$/.test(KEY)) { console.error('[grok-setup] ERROR: key contains unexpected characters.'); process.exit(1); }

  installBinary();
  writeKeyFile();
  configClaude();
  configCodex();
  configOpencode();
  await configSkill();
  await verify();
  log('done. In your agent, the tool set "grok-search" (web_search / get_sources / web_fetch) is now available.');
  log('X search is on: ask e.g. "what is X saying about <topic> today" - Grok will use X as a source.');
}

main().catch((e) => { console.error('[grok-setup] FAILED:', e.message); process.exit(1); });
