import fs from 'node:fs';

const path = 'server.ts';
let source = fs.readFileSync(path, 'utf8');

const demoBlock = `// Store default demo user account\nconst defaultDemoPasswordHash = bcrypt.hashSync('demo1234', 10);\nusersDb.set('anna.ivanova@health.ru', {\n  id: 'usr-1',\n  email: 'anna.ivanova@health.ru',\n  fullName: 'Анна Иванова',\n  passwordHash: defaultDemoPasswordHash,\n  isVerified: true,\n  createdAt: new Date().toISOString(),\n});\n\n`;

if (!source.includes(demoBlock)) {
  throw new Error('Expected demo-user seed block was not found; refusing broad rewrite.');
}
source = source.replace(demoBlock, '');

const oldAuth = `function requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {\n  const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');\n  if (token) {\n    try {\n      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; fullName?: string };\n      req.user = decoded;\n      return next();\n    } catch (err) {\n      // Invalid/expired token - fall through to fallback demo session\n    }\n  }\n\n  // Allow seamless access for demo/guest users\n  req.user = {\n    id: 'usr-1',\n    email: 'anna.ivanova@health.ru',\n    fullName: 'Анна Иванова',\n  };\n  next();\n}\n`;

const newAuth = `function requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {\n  const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');\n  if (!token) {\n    return res.status(401).json({ success: false, message: 'Необходима авторизация.' });\n  }\n\n  try {\n    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; fullName?: string };\n    req.user = decoded;\n    return next();\n  } catch {\n    return res.status(401).json({ success: false, message: 'Сессия недействительна или истекла.' });\n  }\n}\n`;

if (!source.includes(oldAuth)) {
  throw new Error('Expected guest-auth fallback block was not found; refusing broad rewrite.');
}
source = source.replace(oldAuth, newAuth);

for (const forbidden of ['anna.ivanova@health.ru', "bcrypt.hashSync('demo1234'", "id: 'usr-1'"]) {
  if (source.includes(forbidden)) {
    throw new Error(`Forbidden demo auth marker remains in server.ts: ${forbidden}`);
  }
}

fs.writeFileSync(path, source);
console.log('Removed seeded demo account and guest authentication fallback from server.ts');
