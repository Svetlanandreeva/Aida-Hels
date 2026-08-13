import fs from 'node:fs';

const file = 'server.ts';
let source = fs.readFileSync(file, 'utf8');
const original = source;

function replaceOrFail(label, search, replacement) {
  const next = source.replace(search, replacement);
  if (next === source) throw new Error(`Access hardening step did not match: ${label}`);
  source = next;
  console.log(`patched: ${label}`);
}

replaceOrFail(
  'delete-account POST requires authenticated identity only',
  "app.post('/api/auth/delete-account', async (req: AuthenticatedRequest, res) => {",
  "app.post('/api/auth/delete-account', requireAuth, async (req: AuthenticatedRequest, res) => {"
);

replaceOrFail(
  'delete-account DELETE requires authenticated identity only',
  "app.delete('/api/auth/delete-account', async (req: AuthenticatedRequest, res) => {",
  "app.delete('/api/auth/delete-account', requireAuth, async (req: AuthenticatedRequest, res) => {"
);

replaceOrFail(
  'remove client supplied userId override from POST delete-account',
  /\n    if \(req\.body\?\.userId\) \{\n      userId = req\.body\.userId;\n    \}\n\n    if \(!userId && !email\)/,
  "\n    if (!userId && !email)"
);

replaceOrFail(
  'remove client supplied userId override from DELETE delete-account',
  /\n    if \(req\.body\?\.userId\) \{\n      userId = req\.body\.userId;\n    \}\n\n    await performDeleteUserAccount/,
  "\n    await performDeleteUserAccount"
);

replaceOrFail(
  'security logs require authentication',
  "app.get('/api/security/logs', (req, res) => {",
  "app.get('/api/security/logs', requireAuth, (req, res) => {"
);

replaceOrFail(
  'family invitation grants no scopes by default',
  "      allowedScopes: Array.isArray(allowedScopes) ? allowedScopes : ['emergency_card', 'medications'],",
  "      allowedScopes: Array.isArray(allowedScopes) ? allowedScopes : [],"
);

if (source === original) throw new Error('No access-hardening changes were produced');
fs.writeFileSync(file, source);
console.log('server.ts access hardening completed');

const v1File = 'server/v1ApiContractRouter.ts';
let v1 = fs.readFileSync(v1File, 'utf8');
const v1Original = v1;

function replaceV1OrFail(label, search, replacement) {
  const next = v1.replace(search, replacement);
  if (next === v1) throw new Error(`V1 hardening step did not match: ${label}`);
  v1 = next;
  console.log(`patched v1: ${label}`);
}

replaceV1OrFail(
  'readiness must not claim frontend contract is complete',
  '    readyForFrontendDevelopment: true,',
  '    readyForFrontendDevelopment: false,'
);

replaceV1OrFail(
  'readiness must keep UI waiting on partial contracts',
  '    requiresUIWaiting: false,',
  '    requiresUIWaiting: true,'
);

replaceV1OrFail(
  'readiness message reflects partial contracts',
  "    message: 'Frontend can continue against the typed contract, but production readiness is partial and must not be represented as complete.',",
  "    message: 'Часть контрактов и legacy stores ещё не готовы для безопасного использования во всех профилях. UI должен уважать not-ready/empty states.',"
);

if (v1 === v1Original) throw new Error('No v1 readiness changes were produced');
fs.writeFileSync(v1File, v1);
console.log('v1 readiness hardening completed');
