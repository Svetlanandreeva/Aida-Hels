import fs from 'node:fs';

const file = 'src/components/RemindersScreen.tsx';
let source = fs.readFileSync(file, 'utf8');
const original = source;

function replace(label, search, replacement) {
  const next = source.replace(search, replacement);
  if (next === source) throw new Error(`Reminder redesign did not match: ${label}`);
  source = next;
  console.log(`patched: ${label}`);
}

replace(
  'scope reminder redesign',
  '<div className="max-w-4xl mx-auto space-y-6 pb-32 sm:pb-36">',
  '<div className="aida-reminders-screen max-w-5xl mx-auto space-y-5 pb-32 sm:pb-36">'
);

replace(
  'remove unsafe medication presets',
  /\n\s*\{\/\* Quick Presets Section \*\/\}[\s\S]*?\n\s*\{\/\* Filter Tabs \*\/\}/,
  '\n\n      {/* Filter Tabs */}'
);

replace(
  'human notification heading',
  'Всплывающие PUSH-уведомления браузера (Notification API)',
  'Уведомления о приёме и важных событиях'
);

source = source
  .replaceAll('Включить PUSH в браузере', 'Включить уведомления')
  .replaceAll('Проверить PUSH на столе', 'Проверить уведомление')
  .replaceAll('Тестовое всплывающее PUSH-уведомление отправлено!', 'Тестовое уведомление отправлено')
  .replaceAll('Всплывающие PUSH-уведомления в браузере успешно включены! 🎉', 'Уведомления включены')
  .replaceAll('⚙️ Позиции', 'Другое')
  .replaceAll('⚙️ Позиция', 'Другое')
  .replaceAll('Медикамент / Витамины', 'Лекарство')
  .replaceAll('Лекарства & Витамины', 'Лекарства');

if (source === original) throw new Error('No reminder changes produced');
fs.writeFileSync(file, source);
console.log('Reminders redesign applied');
