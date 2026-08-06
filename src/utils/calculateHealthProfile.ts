import {
  UserProfile,
  MedicalDocument,
  DailyLogEntry,
  PressureLogEntry,
  BodySystem,
  StateConnection,
  RecommendedTest,
} from '../types';

export interface HealthProfileResult {
  bodySystems: BodySystem[];
  overallHealthScore: number; // 0..100
  completenessScore: number; // 0..100%
  stateConnections: StateConnection[];
  recommendedNextTests: RecommendedTest[];
  summaryText: string;
}

// Map markers to body system IDs
function categorizeMarkerToSystem(markerName: string): string[] {
  const m = markerName.toLowerCase();

  const systemIds: string[] = [];

  // Cardiovascular
  if (
    m.includes('холестерин') ||
    m.includes('лпнп') ||
    m.includes('лпвп') ||
    m.includes('триглицериды') ||
    m.includes('индекс атерогенности') ||
    m.includes('давление') ||
    m.includes('пульс') ||
    m.includes('тропонин') ||
    m.includes('калий')
  ) {
    systemIds.push('cardio');
  }

  // Endocrine & Metabolism
  if (
    m.includes('глюкоза') ||
    m.includes('гликированный') ||
    m.includes('hba1c') ||
    m.includes('ттг') ||
    m.includes('т4') ||
    m.includes('т3') ||
    m.includes('инсулин') ||
    m.includes('кортизол') ||
    m.includes('ферритин') ||
    m.includes('витамин d') ||
    m.includes('25-oh')
  ) {
    systemIds.push('endocrine');
  }

  // Hematology & Immune
  if (
    m.includes('гемоглобин') ||
    m.includes('эритроцит') ||
    m.includes('лейкоцит') ||
    m.includes('тромбоцит') ||
    m.includes('соэ') ||
    m.includes('с-реактивный') ||
    m.includes('лимфоцит') ||
    m.includes('железо') ||
    m.includes('ферритин')
  ) {
    systemIds.push('immune');
  }

  // Gastrointestinal & Liver
  if (
    m.includes('алт') ||
    m.includes('аст') ||
    m.includes('билирубин') ||
    m.includes('ггт') ||
    m.includes('щелочная фосфатаза') ||
    m.includes('амилаза') ||
    m.includes('липаза') ||
    m.includes('альбумин')
  ) {
    systemIds.push('gastro');
  }

  // Renal & Urinary
  if (
    m.includes('креатинин') ||
    m.includes('мочевина') ||
    m.includes('мочевая кислота') ||
    m.includes('скф') ||
    m.includes('белок в моче')
  ) {
    systemIds.push('urinary');
  }

  // Respiratory
  if (
    m.includes('сатурация') ||
    m.includes('кислород') ||
    m.includes('ige') ||
    m.includes('эозинофил')
  ) {
    systemIds.push('respiratory');
  }

  // Musculoskeletal
  if (
    m.includes('кальций') ||
    m.includes('фосфор') ||
    m.includes('мочевая кислота') ||
    m.includes('витамин d')
  ) {
    systemIds.push('musculoskeletal');
  }

  // Reproductive
  if (
    m.includes('эстрадиол') ||
    m.includes('прогестерон') ||
    m.includes('пролактин') ||
    m.includes('тестостерон') ||
    m.includes('псa') ||
    m.includes('цикл')
  ) {
    systemIds.push('reproductive');
  }

  // Default to immune if unmapped lab
  if (systemIds.length === 0) {
    systemIds.push('immune');
  }

  return systemIds;
}

export function calculateHealthProfile(
  user: UserProfile,
  documents: MedicalDocument[] = [],
  dailyLogs: DailyLogEntry[] = [],
  pressureLogs: PressureLogEntry[] = []
): HealthProfileResult {

  // Flatten all document deviations
  const allDeviations = documents.flatMap((d) => d.deviations || []);

  // Collect all markers extracted
  const allMarkersList: Array<{
    marker: string;
    value: string;
    norm: string;
    status: string;
    explanation: string;
  }> = [];

  documents.forEach((doc) => {
    (doc.deviations || []).forEach((dev) => {
      allMarkersList.push(dev);
    });
  });

  // Base list of 10 organ systems
  const systemsMap: Record<string, {
    name: string;
    iconName: string;
    deviations: typeof allMarkersList;
    baselineDesc: string;
  }> = {
    cardio: {
      name: 'Сердечно-сосудистая система',
      iconName: 'Heart',
      deviations: [],
      baselineDesc: 'Оценка миокарда, тонуса артерий и липидного обмена.',
    },
    endocrine: {
      name: 'Эндокринология и обмен веществ',
      iconName: 'Zap',
      deviations: [],
      baselineDesc: 'Контроль гликемии, щитовидной железы и метаболического баланса.',
    },
    immune: {
      name: 'Кроветворение и иммунитет',
      iconName: 'Shield',
      deviations: [],
      baselineDesc: 'Оценка клеточного состава крови, запасов железа и воспаления.',
    },
    gastro: {
      name: 'Желудочно-кишечный тракт и печень',
      iconName: 'Apple',
      deviations: [],
      baselineDesc: 'Функция гепатобилиарной системы, ферменты и пищеварение.',
    },
    urinary: {
      name: 'Мочевыделительная система и почки',
      iconName: 'Droplets',
      deviations: [],
      baselineDesc: 'Фильтрационная способность почек и водно-солевой баланс.',
    },
    respiratory: {
      name: 'Дыхательная система',
      iconName: 'Wind',
      deviations: [],
      baselineDesc: 'Оксигенация тканей и газообмен в легких.',
    },
    neuro: {
      name: 'Нервная система и психика',
      iconName: 'Brain',
      deviations: [],
      baselineDesc: 'Уровень стресса, нейрохимический баланс и качество сна.',
    },
    musculoskeletal: {
      name: 'Костно-мышечная система',
      iconName: 'Bone',
      deviations: [],
      baselineDesc: 'Минерализация костей, суставы и уровень кальция/витамина D.',
    },
    reproductive: {
      name: 'Репродуктивное здоровье',
      iconName: 'Flame',
      deviations: [],
      baselineDesc: 'Гормональный баланс и функции половой системы.',
    },
    skin: {
      name: 'Кожа и покровная система',
      iconName: 'Activity',
      deviations: [],
      baselineDesc: 'Барьерная функция, микронутриентный статус кожи и волос.',
    },
  };

  // Assign markers to systems
  allMarkersList.forEach((dev) => {
    const targetSystemIds = categorizeMarkerToSystem(dev.marker);
    targetSystemIds.forEach((sysId) => {
      if (systemsMap[sysId]) {
        systemsMap[sysId].deviations.push(dev);
      }
    });
  });

  // Also check pressure logs for cardio
  const latestPressure = pressureLogs[0];
  if (latestPressure && (latestPressure.systolic >= 140 || latestPressure.diastolic >= 90)) {
    systemsMap.cardio.deviations.push({
      marker: 'Артериальное давление',
      value: `${latestPressure.systolic}/${latestPressure.diastolic} мм рт. ст.`,
      norm: '< 130/85',
      status: 'Выше',
      explanation: 'Зафиксировано повышенное системное артериальное давление.',
    });
  }

  // Also check stress / sleep for neuro
  const latestDailyLog = dailyLogs[0];
  if (user.psychology?.stressLevel >= 7 || (latestDailyLog && latestDailyLog.stress >= 7)) {
    systemsMap.neuro.deviations.push({
      marker: 'Психоэмоциональный стресс',
      value: `${user.psychology?.stressLevel || latestDailyLog?.stress}/10`,
      norm: '1-4',
      status: 'Выше',
      explanation: 'Высокий уровень стресса повышает уровень кортизола.',
    });
  }

  // Construct BodySystem objects
  const bodySystems: BodySystem[] = Object.entries(systemsMap).map(([id, sys]) => {
    const devCount = sys.deviations.length;
    let score = 95;
    let status: 'norm' | 'warning' | 'critical' | 'insufficient_data' = 'norm';
    let statusText = 'В норме';
    let attentionLevel: 'Низкий' | 'Умеренный' | 'Высокий' = 'Низкий';

    if (devCount === 0) {
      if (documents.length === 0) {
        status = 'insufficient_data';
        statusText = 'Требуются данные';
        score = 0;
      } else {
        score = 92;
        statusText = 'Отклонений не выявлено';
      }
    } else if (devCount === 1) {
      score = 75;
      status = 'warning';
      statusText = 'Требует внимания';
      attentionLevel = 'Умеренный';
    } else {
      score = Math.max(45, 70 - (devCount - 2) * 15);
      status = 'critical';
      statusText = 'Выраженное внимание';
      attentionLevel = 'Высокий';
    }

    // Detailed analysis text
    let detailedAnalysis = sys.baselineDesc;
    if (devCount > 0) {
      const markersText = sys.deviations.map((d) => `${d.marker} (${d.value})`).join(', ');
      detailedAnalysis = `По результатам исследований обнаружены отклонения в показателях: ${markersText}. ${sys.deviations[0].explanation}`;
    } else if (documents.length > 0) {
      detailedAnalysis = `Исследованные показатели находятся в границах нормы. Система работает стабильно.`;
    }

    // Lifestyle recommendations
    const lifestyleRecommendations: string[] = [];
    if (id === 'cardio') {
      lifestyleRecommendations.push('Ограничьте поваренную соль до 5 г/сутки.');
      lifestyleRecommendations.push('30 минут аэробной активности средней интенсивности 5 раз в неделю.');
    } else if (id === 'endocrine') {
      lifestyleRecommendations.push('Исключите быстрые углеводы и сладкие напитки.');
      lifestyleRecommendations.push('Соблюдайте режим сна: отход ко сну до 23:00 для гармонизации гормонов.');
    } else if (id === 'immune') {
      lifestyleRecommendations.push('Включите в рацион гемовое железо (говядина, печень) и витамин С.');
      lifestyleRecommendations.push('Избегайте хронического переутомления.');
    } else if (id === 'gastro') {
      lifestyleRecommendations.push('Дробное питание 4-5 раз в день без длинных перерывов.');
      lifestyleRecommendations.push('Исключите жареную, жирную и острую пищу.');
    } else if (id === 'urinary') {
      lifestyleRecommendations.push('Поддерживайте питьевой режим: не менее 30 мл чистой воды на 1 кг массы тела.');
    } else {
      lifestyleRecommendations.push('Соблюдайте сбалансированное питание и полноценный сон.');
    }

    // System specific tests
    const recommendedTests: Array<{ name: string; reason: string; urgency: 'Срочно' | 'Рекомендуется' }> = [];
    if (devCount > 0) {
      sys.deviations.forEach((d) => {
        const m = d.marker.toLowerCase();
        if (m.includes('гемоглобин') || m.includes('ферритин')) {
          recommendedTests.push({
            name: 'Витамин B12 и Фолиевая кислота (B9)',
            reason: 'Для дифференциальной диагностики причин анемического синдрома.',
            urgency: 'Рекомендуется',
          });
          recommendedTests.push({
            name: 'Сывороточное железо и ОЖСС',
            reason: 'Оценка свободного железа и связывающей способности сыворотки.',
            urgency: 'Рекомендуется',
          });
        }
        if (m.includes('глюкоза')) {
          recommendedTests.push({
            name: 'Гликированный гемоглобин (HbA1c)',
            reason: 'Оценка среднего уровня сахара в крови за последние 3 месяца.',
            urgency: 'Срочно',
          });
          recommendedTests.push({
            name: 'Инсулин и индекс HOMA-IR',
            reason: 'Диагностика скрытой инсулинорезистентности.',
            urgency: 'Рекомендуется',
          });
        }
        if (m.includes('холестерин')) {
          recommendedTests.push({
            name: 'Развёрнутая липидограмма (ЛПВП, ЛПНП, Триглицериды)',
            reason: 'Расчёт атерогенного коэффициента и оценка сердечного риска.',
            urgency: 'Рекомендуется',
          });
          recommendedTests.push({
            name: 'УЗИ сонных артерий (УЗДГ БЦА)',
            reason: 'Визуализация отсутствия бляшек при высокой дислипидемии.',
            urgency: 'Рекомендуется',
          });
        }
        if (m.includes('ттг')) {
          recommendedTests.push({
            name: 'Свободный Т3 и Свободный Т4',
            reason: 'Оценка активности тиреоидных гормонов.',
            urgency: 'Срочно',
          });
          recommendedTests.push({
            name: 'Антитела к ТПО (Анти-ТПО)',
            reason: 'Исключение аутоиммунного тиреоидита.',
            urgency: 'Рекомендуется',
          });
        }
        if (m.includes('алт') || m.includes('аст') || m.includes('билирубин')) {
          recommendedTests.push({
            name: 'УЗИ органов брюшной полости',
            reason: 'Оценка структуры печени, желчного пузыря и поджелудочной железы.',
            urgency: 'Срочно',
          });
        }
        if (m.includes('креатинин') || m.includes('мочевина')) {
          recommendedTests.push({
            name: 'Расчёт СКФ (по формуле CKD-EPI)',
            reason: 'Точная оценка скорости клубочковой фильтрации почек.',
            urgency: 'Срочно',
          });
        }
      });
    }

    return {
      id,
      name: sys.name,
      iconName: sys.iconName,
      score,
      status,
      statusText,
      description: detailedAnalysis,
      attentionLevel,
      deviationsCount: devCount,
      detailedAnalysis,
      lifestyleRecommendations,
      recommendedTests,
    };
  });

  // Calculate Overall Health Score
  let overallHealthScore = 85;
  if (documents.length === 0) {
    overallHealthScore = 0; // Insufficient data
  } else if (allDeviations.length > 0) {
    overallHealthScore = Math.max(35, Math.round(92 - allDeviations.length * 12));
  }

  // Completeness score
  const testedSystemsCount = bodySystems.filter((s) => s.status !== 'insufficient_data').length;
  const completenessScore = Math.round((testedSystemsCount / 10) * 100);

  // Dynamic Inter-System State Connections ("Связи состояний")
  const stateConnections: StateConnection[] = [];

  // Check 1: Iron Deficiency Anemia Chain
  const ferritinDev = allDeviations.find((d) => d.marker.toLowerCase().includes('ферритин') || d.marker.toLowerCase().includes('гемоглобин'));
  if (ferritinDev) {
    stateConnections.push({
      id: 'sc-iron-anemia',
      title: 'Взаимосвязь: Дефицит железа и Гипоксия тканей',
      sourceMarker: `${ferritinDev.marker} (${ferritinDev.value})`,
      affectedSystems: ['Кроветворение и иммунитет', 'Сердечно-сосудистая система', 'Нервная система'],
      severity: ferritinDev.status === 'Ниже' || ferritinDev.status === 'Внимание' ? 'critical' : 'warning',
      mechanism: 'Снижение уровня ферритина или гемоглобина ограничивает транспортировку кислорода к клеткам. Для компенсации гипоксии сердце вынуждено работать с повышенным пульсом, а мозг испытывает дефицит энергии (слабость, снижение концентрации).',
      recommendation: 'Сдать развернутый анализ на железо (сывороточное железо, ОЖСС, трансферрин, витамин B12) и проконсультироваться с терапевтом.',
    });
  }

  // Check 2: Thyroid & Metabolic Lipid Chain
  const tshDev = allDeviations.find((d) => d.marker.toLowerCase().includes('ттг'));
  const cholDev = allDeviations.find((d) => d.marker.toLowerCase().includes('холестерин'));
  if (tshDev || (tshDev && cholDev)) {
    stateConnections.push({
      id: 'sc-thyroid-lipid',
      title: 'Взаимосвязь: Щитовидная железа и Липидный обмен',
      sourceMarker: tshDev ? `${tshDev.marker} (${tshDev.value})` : 'Тиреоидный статус',
      affectedSystems: ['Эндокринология и обмен веществ', 'Сердечно-сосудистая система', 'Желудочно-кишечный тракт'],
      severity: 'warning',
      mechanism: 'Гормоны щитовидной железы регулируют скорость основного обмена веществ. Нарушение тиреоидного статуса напрямую замедляет утилизацию холестерина в печени и может вести к дислипидемии.',
      recommendation: 'Пройти обследование на свободный Т3, свободный Т4 и Анти-ТПО у эндокринолога.',
    });
  }

  // Check 3: Glycemia & Vascular Kidney Chain
  const glucoseDev = allDeviations.find((d) => d.marker.toLowerCase().includes('глюкоза') || d.marker.toLowerCase().includes('гликированный'));
  if (glucoseDev) {
    stateConnections.push({
      id: 'sc-glucose-renal',
      title: 'Взаимосвязь: Уровень сахара и Нагрузка на сосуды/почки',
      sourceMarker: `${glucoseDev.marker} (${glucoseDev.value})`,
      affectedSystems: ['Эндокринология и обмен веществ', 'Мочевыделительная система', 'Сердечно-сосудистая система'],
      severity: 'critical',
      mechanism: 'Хроническое повышение глюкозы приводит к гликированию белков сосудистой стенки и мелких капилляров почечных клубочков (микроангиопатия).',
      recommendation: 'Контроль гликированного гемоглобина (HbA1c), индекса HOMA-IR и белка в суточной моче.',
    });
  }

  // Check 4: High Pressure & Heart Burden
  if (latestPressure && latestPressure.systolic >= 140) {
    stateConnections.push({
      id: 'sc-hypertension',
      title: 'Взаимосвязь: Артериальная гипертензия и Сердечно-сосудистая нагрузка',
      sourceMarker: `Давление ${latestPressure.systolic}/${latestPressure.diastolic} мм рт. ст.`,
      affectedSystems: ['Сердечно-сосудистая система', 'Нервная система', 'Мочевыделительная система'],
      severity: 'critical',
      mechanism: 'Повышенное артериальное давление усиливает сопротивление сосудов, повышает постнагрузку на левый желудочек сердца и капилляры головного мозга.',
      recommendation: 'Вести ежедневный дневник давления, пройти ЭКГ и СМАД (суточное мониторирование АД).',
    });
  }

  // Check 5: Stress & Immune Barrier Chain
  if (user.psychology?.stressLevel >= 7) {
    stateConnections.push({
      id: 'sc-stress-immune',
      title: 'Взаимосвязь: Стресс и Иммунный ответ (Психонейроиммунология)',
      sourceMarker: `Уровень стресса: ${user.psychology.stressLevel}/10`,
      affectedSystems: ['Нервная система и психика', 'Кроветворение и иммунитет', 'ЖКТ'],
      severity: 'warning',
      mechanism: 'Повышенная секреция кортизола при стрессе угнетает активность T-лимфоцитов и защитные барьеры слизистых оболочек, повышая частоту ОРВИ.',
      recommendation: 'Регуляция сна, практики дыхания 4-7-8, прием магния цитрата/глицината после согласования с врачом.',
    });
  }

  // Master Recommended Next Tests ("Что еще надо сдать для 100% анализа")
  const recommendedNextTests: RecommendedTest[] = [];

  // Extract all system-recommended tests first
  bodySystems.forEach((sys) => {
    sys.recommendedTests.forEach((t) => {
      if (!recommendedNextTests.some((r) => r.name === t.name)) {
        recommendedNextTests.push({
          id: `rec-${Math.random().toString(36).substring(2, 7)}`,
          name: t.name,
          category: t.name.includes('УЗИ') ? 'УЗИ / МРТ' : 'Лабораторный анализ',
          reason: t.reason,
          urgency: t.urgency,
          targetSystem: sys.name,
        });
      }
    });
  });

  // Basic essential baseline checkups if missing
  const uploadedMarkerNames = allMarkersList.map((m) => m.marker.toLowerCase());

  if (!uploadedMarkerNames.some((m) => m.includes('витамин d'))) {
    recommendedNextTests.push({
      id: 'rec-vit-d',
      name: '25-OH Витамин D (суммарный)',
      category: 'Лабораторный анализ',
      reason: 'Необходим для корректной оценки иммунитета, костной ткани и регуляции гормонов.',
      urgency: 'Рекомендуется',
      targetSystem: 'Эндокринология и обмен веществ',
    });
  }

  if (!uploadedMarkerNames.some((m) => m.includes('холестерин') || m.includes('лпнп'))) {
    recommendedNextTests.push({
      id: 'rec-lipid-panel',
      name: 'Липидный профиль (Холестерин, ЛПВП, ЛПНП, Триглицериды)',
      category: 'Лабораторный анализ',
      reason: 'Базовый скрининг сосудистого риска и функции печени.',
      urgency: 'Рекомендуется',
      targetSystem: 'Сердечно-сосудистая система',
    });
  }

  if (!uploadedMarkerNames.some((m) => m.includes('ттг'))) {
    recommendedNextTests.push({
      id: 'rec-tsh',
      name: 'ТТГ (Тиреотропный гормон)',
      category: 'Лабораторный анализ',
      reason: 'Скрининг функции щитовидной железы и метаболической скорости.',
      urgency: 'Рекомендуется',
      targetSystem: 'Эндокринология и обмен веществ',
    });
  }

  if (!uploadedMarkerNames.some((m) => m.includes('креатинин') || m.includes('алт'))) {
    recommendedNextTests.push({
      id: 'rec-biochem-basic',
      name: 'Биохимический анализ крови (АЛТ, АСТ, Билирубин, Креатинин, Мочевина)',
      category: 'Лабораторный анализ',
      reason: 'Оценка функций печени, почек и белкового обмена.',
      urgency: 'Рекомендуется',
      targetSystem: 'Желудочно-кишечный тракт и печень',
    });
  }

  if (!uploadedMarkerNames.some((m) => m.includes('гемоглобин') || m.includes('лейкоцит'))) {
    recommendedNextTests.push({
      id: 'rec-cbc',
      name: 'Общий анализ крови (ОАК) с лейкоцитарной формулой и СОЭ',
      category: 'Лабораторный анализ',
      reason: 'Фундаментальный скрининг инфекций, анемии и воспалительных процессов.',
      urgency: 'Срочно',
      targetSystem: 'Кроветворение и иммунитет',
    });
  }

  // Summary message
  let summaryText = '';
  if (documents.length === 0) {
    summaryText = 'Нажмите «Загрузить бланк» или добавьте данные анализов, чтобы Аида рассчитала баланс 10 систем и установила связи состояний.';
  } else if (allDeviations.length === 0) {
    summaryText = `Проанализировано ${documents.length} исследований. Все ключевые показатели находятся в референсных диапазонах нормы!`;
  } else {
    summaryText = `Проанализировано ${documents.length} исследований. Выявлено ${allDeviations.length} показателей, требующих внимания, и сформировано ${stateConnections.length} цепочек взаимосвязей между системами.`;
  }

  return {
    bodySystems,
    overallHealthScore,
    completenessScore,
    stateConnections,
    recommendedNextTests: recommendedNextTests.slice(0, 6), // top 6 priorities
    summaryText,
  };
}
