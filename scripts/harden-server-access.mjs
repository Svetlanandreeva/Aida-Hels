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
