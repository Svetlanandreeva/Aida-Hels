export type VitalKind = "weight" | "temperature" | "pulse" | "spo2" | "waist";

const ranges: Record<VitalKind | "systolic" | "diastolic", [number, number]> = {
  systolic: [30, 350],
  diastolic: [20, 250],
  pulse: [20, 300],
  weight: [0.1, 500],
  temperature: [25, 45],
  spo2: [1, 100],
  waist: [10, 300],
};

const parseNumber = (raw: string) => {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
};

const inRange = (value: number, key: keyof typeof ranges) => {
  const [min, max] = ranges[key];
  return value >= min && value <= max;
};

export function validateBloodPressureInput(sysRaw: string, diaRaw: string, pulseRaw: string, ru: boolean) {
  const systolic = parseNumber(sysRaw);
  const diastolic = parseNumber(diaRaw);
  const pulse = pulseRaw.trim() ? parseNumber(pulseRaw) : null;
  const invalid = ru ? "Проверьте введённые значения" : "Check the entered values";

  if (systolic === null || diastolic === null) return { error: invalid } as const;
  if (!inRange(systolic, "systolic") || !inRange(diastolic, "diastolic")) return { error: invalid } as const;
  if (systolic <= diastolic) {
    return { error: ru ? "Верхнее давление должно быть выше нижнего" : "Systolic pressure must be higher than diastolic" } as const;
  }
  if (pulseRaw.trim() && (pulse === null || !inRange(pulse, "pulse"))) return { error: invalid } as const;

  return { value: { systolic, diastolic, pulse } } as const;
}

export function validateMeasurementInput(kind: VitalKind, raw: string, ru: boolean) {
  const value = parseNumber(raw);
  if (value === null || !inRange(value, kind)) {
    return { error: ru ? "Проверьте значение измерения" : "Check the measurement value" } as const;
  }
  return { value } as const;
}
