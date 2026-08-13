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
    ],
  },
  {
    file: 'server.ts',
    patterns: [
      /anna\.ivanova@health\.ru/,
      /id\s*:\s*['"]usr-1['"]/,
      /fullName\s*:\s*['"]Анна Иванова['"]/,
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

console.log('Production safety audit passed: no known fake/demo medical-data blockers found.');
