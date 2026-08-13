import fs from 'node:fs';

const checks = [
  {
    file: 'server/canonicalDataLayer.ts',
    patterns: [
      /systolic\s*:\s*[^\n]*\|\|\s*120/,
      /diastolic\s*:\s*[^\n]*\|\|\s*80/,
      /pulse\s*:\s*[^\n]*\|\|\s*72/,
      /sleep\s*:\s*[^\n]*\|\|\s*8/,
      /stress\s*:\s*[^\n]*\|\|\s*3/,
      /mood\s*:\s*['"]нормальное['"]/i,
    ],
  },
  {
    file: 'server/homeApiService.ts',
    patterns: [
      /mood:\s*latest\?\.mood\s*\|\|\s*['"]Нормальное['"]/,
      /Показатели стабильны\./,
      /плановый приём витаминов/i,
      /time:\s*r\.time\s*\|\|\s*['"]09:00['"]/,
    ],
  },
  {
    file: 'server/permissionService.ts',
    patterns: [/seedDemoGrants\s*\(/, /grant-demo-/i, /demo-user-/i],
  },
  {
    file: 'server/v1ApiContractRouter.ts',
    patterns: [
      /user_demo_me/,
      /demo@medai\.ru/,
      /birthDate\s*:\s*[^\n]*['"]1990-01-01['"]/,
      /birthDate\s*:\s*[^\n]*['"]1995-01-01['"]/,
      /birthDate\s*:\s*[^\n]*['"]2020-01-01['"]/,
      /readyForFrontendDevelopment\s*:\s*true/,
      /sleepHours\s*:\s*Number\(sleepHours\s*\|\|\s*8\)/,
      /state_score\s*:\s*state_score\s*\|\|\s*7/,
      /cycleDay\s*:\s*14/,
      /gestatingWeeks\s*:\s*gestatingWeeks\s*\|\|\s*12/,
    ],
  },
  {
    file: 'server/integrationsService.ts',
    patterns: [
      /id:\s*['"]apple_health['"][\s\S]{0,200}status:\s*['"]supported['"]/,
      /id:\s*['"]health_connect['"][\s\S]{0,200}status:\s*['"]supported['"]/,
      /Официальный адаптер активен/,
      /diastolic:[^\n]*\|\|\s*80/,
      /deepSleepMinutes:[^\n]*0\.25/,
      /remSleepMinutes:[^\n]*0\.20/,
      /cyclePhase:[^\n]*['"]follicular['"]/,
      /flowLevel:[^\n]*['"]light['"]/,
      /deviceName\s*=\s*['"]Apple Watch Series 9['"]/,
      /batteryLevel:\s*88/,
    ],
  },
  {
    file: 'server.ts',
    patterns: [
      /anna\.ivanova@health\.ru/,
      /id\s*:\s*['"]usr-1['"]/,
      /fullName\s*:\s*['"]Анна Иванова['"]/,
      /helt_aida_secure_session_secret_2026/,
      /Allow seamless access for demo\/guest users/i,
      /fallback demo session/i,
      /consentPersonalData[^\n]*\?\?[^\n]*true/,
      /consentMedicalData[^\n]*\?\?[^\n]*true/,
      /data:\s*\{\s*code:\s*rawCode[^}]*hash:/s,
      /user\.isVerified\s*=\s*true;\s*\n\s*\n\s*\/\/ Create session via AuthService/,
      /const\s*\{\s*code,\s*expiresAt\s*\}\s*=\s*authService\.requestRecovery/,
      /app\.use\(['"]\/api\/v1['"],\s*v1ApiRouter\)/,
      /app\.post\(['"]\/api\/auth\/delete-account['"],\s*async/,
      /app\.delete\(['"]\/api\/auth\/delete-account['"],\s*async/,
      /if\s*\(req\.body\?\.userId\)/,
      /app\.get\(['"]\/api\/security\/logs['"],\s*\(req,\s*res\)/,
      /allowedScopes:\s*Array\.isArray\(allowedScopes\)\s*\?\s*allowedScopes\s*:\s*\[['"]emergency_card['"],\s*['"]medications['"]\]/,
    ],
  },
  {
    file: 'src/utils/calculateOrganismAge.ts',
    patterns: [
      /value\s*:\s*['"]118\/76/,
      /value\s*:\s*['"]4\.2 ммоль\/л/,
      /value\s*:\s*['"]72 мкмоль\/л/,
      /impactYears\s*:\s*[+-]1\.6/,
    ],
  },
];

let failures = 0;
for (const check of checks) {
  if (!fs.existsSync(check.file)) {
    console.error(`FAIL ${check.file}: file not found`);
    failures++;
    continue;
  }
  const source = fs.readFileSync(check.file, 'utf8');
  for (const pattern of check.patterns) {
    if (pattern.test(source)) {
      console.error(`FAIL ${check.file}: forbidden production pattern ${pattern}`);
      failures++;
    }
  }
}

if (failures > 0) {
  console.error(`\nProduction safety audit failed: ${failures} blocker(s).`);
  process.exit(1);
}
console.log('Production safety audit passed: no known fake/demo medical-data, auth, access or integration-readiness blockers found.');
