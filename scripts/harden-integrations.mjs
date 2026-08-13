import fs from 'node:fs';

const file = 'server/integrationsService.ts';
let source = fs.readFileSync(file, 'utf8');
const original = source;

function replaceOrFail(label, search, replacement) {
  const next = source.replace(search, replacement);
  if (next === source) throw new Error(`Integration hardening step did not match: ${label}`);
  source = next;
  console.log(`patched integrations: ${label}`);
}

replaceOrFail(
  'Apple Health must not claim native adapter is active',
  "      status: 'supported',\n      statusMessage: 'Официальный адаптер активен. Нативная синхронизация с iOS HealthKit.',",
  "      status: 'preview_bridge',\n      statusMessage: 'Контракт и canonical mapping подготовлены. Нативный HealthKit bridge ещё не подключён; реальная синхронизация недоступна.',"
);

replaceOrFail(
  'Health Connect must not claim native adapter is active',
  "      status: 'supported',\n      statusMessage: 'Официальный адаптер активен. Единое хранилище Android Health Connect.',",
  "      status: 'preview_bridge',\n      statusMessage: 'Контракт и canonical mapping подготовлены. Нативный Health Connect bridge ещё не подключён; реальная синхронизация недоступна.',"
);

replaceOrFail(
  'connecting source requires implemented provider adapter',
  "    if (!provider) {\n      throw new Error(`Неизвестный провайдер интеграции: ${providerId}`);\n    }",
  "    if (!provider) {\n      throw new Error(`Неизвестный провайдер интеграции: ${providerId}`);\n    }\n    if (provider.status !== 'supported') {\n      throw new Error(`INTEGRATION_NOT_READY: ${provider.name}. ${provider.statusMessage}`);\n    }"
);

replaceOrFail(
  'adapter pipeline requires implemented provider adapter',
  "    if (!provider) {\n      throw new Error(`Неизвестный или неподдерживаемый провайдер: ${providerId}`);\n    }",
  "    if (!provider) {\n      throw new Error(`Неизвестный или неподдерживаемый провайдер: ${providerId}`);\n    }\n    if (provider.status !== 'supported') {\n      throw new Error(`INTEGRATION_NOT_READY: ${provider.name}. ${provider.statusMessage}`);\n    }"
);

replaceOrFail(
  'do not fabricate missing diastolic pressure',
  "            diastolic: Number(rawSample.diastolic || rawSample.valueComponents?.diastolic || 80),",
  "            diastolic: rawSample.diastolic !== undefined || rawSample.valueComponents?.diastolic !== undefined\n              ? Number(rawSample.diastolic ?? rawSample.valueComponents?.diastolic)\n              : undefined,"
);

replaceOrFail(
  'do not fabricate sleep stages',
  "            durationMinutes: rawSample.durationMinutes ?? Math.round(numVal * 60),\n            deepSleepMinutes: rawSample.deepSleepMinutes ?? Math.round(numVal * 60 * 0.25),\n            remSleepMinutes: rawSample.remSleepMinutes ?? Math.round(numVal * 60 * 0.20),\n            lightSleepMinutes: rawSample.lightSleepMinutes ?? Math.round(numVal * 60 * 0.45),\n            awakeMinutes: rawSample.awakeMinutes ?? Math.round(numVal * 60 * 0.10),",
  "            durationMinutes: rawSample.durationMinutes ?? Math.round(numVal * 60),\n            deepSleepMinutes: rawSample.deepSleepMinutes,\n            remSleepMinutes: rawSample.remSleepMinutes,\n            lightSleepMinutes: rawSample.lightSleepMinutes,\n            awakeMinutes: rawSample.awakeMinutes,"
);

replaceOrFail(
  'do not invent cycle phase or flow',
  "            cycleDay: rawSample.cycleDay || numVal,\n            cyclePhase: rawSample.cyclePhase || 'follicular',\n            flowLevel: rawSample.flowLevel || 'light',",
  "            cycleDay: rawSample.cycleDay ?? numVal,\n            cyclePhase: rawSample.cyclePhase,\n            flowLevel: rawSample.flowLevel,"
);

replaceOrFail(
  'do not invent workout type',
  "            activityType: rawSample.activityType || 'general_workout',",
  "            activityType: rawSample.activityType,"
);

if (source === original) throw new Error('No integration hardening changes were produced');
fs.writeFileSync(file, source);
console.log('integration readiness/no-fake-data hardening completed');
