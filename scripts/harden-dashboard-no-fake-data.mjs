import fs from 'node:fs';

const file = 'src/components/Dashboard.tsx';
let source = fs.readFileSync(file, 'utf8');

function replaceExact(from, to, label) {
  if (!source.includes(from)) {
    throw new Error(`Dashboard no-fake hardening failed: missing expected pattern for ${label}`);
  }
  source = source.replace(from, to);
}

replaceExact(
`    const result: Array<{ day: string; energy: number; sleep: number; stress: number; mood: number }> = [];`,
`    const result: Array<{ day: string; energy?: number; sleep?: number; stress?: number; mood?: number }> = [];`,
'chart points allow missing metrics'
);

replaceExact(
`        const avgEnergy = Math.round(\n          (dayDiary.reduce((acc, curr) => acc + (curr.energy_score || 5), 0) / dayDiary.length) * 10\n        );\n        const avgStress = Math.round(\n          (dayDiary.reduce((acc, curr) => acc + (curr.stress_score || curr.anxiety_score || 3), 0) / dayDiary.length) * 10\n        );\n        const avgMood = Math.round(\n          (dayDiary.reduce((acc, curr) => acc + (curr.state_score || 6), 0) / dayDiary.length) * 10\n        );\n        const sleepEntry = dayDiary.find((e) => e.physical_factors?.sleepDurationHours !== undefined);\n        const avgSleep = sleepEntry?.physical_factors?.sleepDurationHours\n          ? Math.min(100, Math.round((sleepEntry.physical_factors.sleepDurationHours / 8) * 100))\n          : 70;\n\n        result.push({ day: dayName, energy: avgEnergy, sleep: avgSleep, stress: avgStress, mood: avgMood });`,
`        const energyValues = dayDiary\n          .map((entry) => entry.energy_score)\n          .filter((value): value is number => typeof value === 'number');\n        const stressValues = dayDiary\n          .map((entry) => entry.stress_score ?? entry.anxiety_score)\n          .filter((value): value is number => typeof value === 'number');\n        const moodValues = dayDiary\n          .map((entry) => entry.state_score)\n          .filter((value): value is number => typeof value === 'number');\n        const sleepValues = dayDiary\n          .map((entry) => entry.physical_factors?.sleepDurationHours)\n          .filter((value): value is number => typeof value === 'number');\n\n        const avgEnergy = energyValues.length > 0\n          ? Math.round((energyValues.reduce((sum, value) => sum + value, 0) / energyValues.length) * 10)\n          : undefined;\n        const avgStress = stressValues.length > 0\n          ? Math.round((stressValues.reduce((sum, value) => sum + value, 0) / stressValues.length) * 10)\n          : undefined;\n        const avgMood = moodValues.length > 0\n          ? Math.round((moodValues.reduce((sum, value) => sum + value, 0) / moodValues.length) * 10)\n          : undefined;\n        const avgSleep = sleepValues.length > 0\n          ? Math.min(100, Math.round(((sleepValues.reduce((sum, value) => sum + value, 0) / sleepValues.length) / 8) * 100))\n          : undefined;\n\n        if ([avgEnergy, avgSleep, avgStress, avgMood].some((value) => typeof value === 'number')) {\n          result.push({ day: dayName, energy: avgEnergy, sleep: avgSleep, stress: avgStress, mood: avgMood });\n        }`,
'diary chart uses only observed values'
);

replaceExact(
`      } else {\n        result.push({\n          day: dayName,\n          energy: 0,\n          sleep: 0,\n          stress: 0,\n          mood: 0,\n        });\n      }`,
`      }`,
'no fake zero chart points'
);

replaceExact(
`    const activeDays = result.filter((r) => r.energy > 0 || r.sleep > 0 || r.stress > 0 || r.mood > 0).length;`,
`    const activeDays = result.filter((r) => [r.energy, r.sleep, r.stress, r.mood].some((value) => typeof value === 'number')).length;`,
'count only days with observed metrics'
);

fs.writeFileSync(file, source);
console.log('Dashboard no-fake-data hardening applied.');
