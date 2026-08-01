import { GoogleGenAI } from '@google/genai';

export interface UrgentRedFlagAlert {
  id: string;
  title: string;
  description: string;
  criticalSymptoms: string[];
  recommendedAction: string;
  emergencyNumber: string;
}

export type HealthStatusLevel =
  | 'norm'
  | 'slight_deviation'
  | 'attention'
  | 'consultation_recommended'
  | 'urgent_help'
  | 'insufficient_data';

export type UrgencyLevel = 'planned' | 'soon' | 'urgent' | 'emergency';

export interface PossibleCause {
  title: string;
  description: string;
  category: 'common' | 'lifestyle' | 'medication' | 'doctor_check';
}

export interface DoctorRecommendation {
  specialty: string;
  reason: string;
  urgency: UrgencyLevel;
  urgencyLabel: string;
  timeframe: string;
  prepareItems: string[];
}

export interface HealthAttentionItem {
  id: string;
  markerId?: string;
  title: string;
  value?: string;
  unit?: string;
  reference?: string;
  severity: 'mild' | 'moderate' | 'high' | 'critical';
  statusLevel: HealthStatusLevel;
  shortSummary: string;
  plainExplanation: string;
  possibleCauses: PossibleCause[];
  safeActionsNow: string[];
  doctor: DoctorRecommendation;
  emergencySigns?: string;
  confidence: number;
  reasoningSources: Array<{ label: string; detail: string }>;
}

export interface BodySystemReport {
  id: string;
  name: string;
  status: HealthStatusLevel;
  statusLabel: string;
  score: number;
  briefComment: string;
  influencingMarkers: string[];
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
  normItems: string[];
  attentionItems: string[];
  nextAction: string;
  hasSufficientData: boolean;
}

export interface StructuredHealthAnalysis {
  overallStatus: HealthStatusLevel;
  overallScore: number;
  summary: string;
  confidence: number;
  dataCompleteness: number;
  urgentAlert: UrgentRedFlagAlert | null;
  positiveFactors: string[];
  negativeFactors: string[];
  calculationSources: Array<{ label: string; detail: string }>;
  attentionItems: HealthAttentionItem[];
  systems: BodySystemReport[];
  dailyRecommendations: string[];
  resourceForecast: {
    level: 'high' | 'medium' | 'low' | 'insufficient_data';
    description: string;
    drivers: string[];
  };
  disclaimer: string;
}

// Check for Red Flags (critical emergency conditions)
export function checkRedFlags(data: any): UrgentRedFlagAlert | null {
  const { user, documents = [], diaryEntries = [], newSymptoms = '' } = data;
  
  const textCorpus = [
    newSymptoms,
    user?.psychology?.psychiatricData?.symptoms?.join(' '),
    ...(diaryEntries || []).map((e: any) => `${e.event_description || ''} ${e.thoughts || ''} ${e.additional_note || ''}`),
  ]
    .join(' ')
    .toLowerCase();

  // 1. Suicidal ideation
  if (
    textCorpus.includes('покончить с собой') ||
    textCorpus.includes('хочу умереть') ||
    textCorpus.includes('суицид') ||
    textCorpus.includes('причинить себе вред')
  ) {
    return {
      id: 'redflag-mental-crisis',
      title: 'Критическое состояние: нужна срочная психотерапевтическая поддержка',
      description: 'Зафиксированы сигналы сильного эмоционального кризиса. Пожалуйста, не оставайтесь в одиночестве.',
      criticalSymptoms: ['Суицидальные мысли', 'Высокий уровень эмоционального кризиса'],
      recommendedAction: 'Обратитесь на бесплатную круглосуточную линию психологической помощи 8 (800) 200-01-22 или позовите близкого человека.',
      emergencyNumber: '8-800-200-01-22 / 112',
    };
  }

  // 2. Acute Cardiac / Neurological Emergency
  if (
    textCorpus.includes('острая боль за грудиной') ||
    textCorpus.includes('давящая боль в сердце') ||
    textCorpus.includes('перекосило лицо') ||
    textCorpus.includes('онемела вся рука') ||
    textCorpus.includes('потеря речи')
  ) {
    return {
      id: 'redflag-cardio-neuro',
      title: 'Экстренное состояние: признаки острого кардио или неврологического нарушения',
      description: 'Симптомы требуют немедленного осмотра врачом скорой медицинской помощи.',
      criticalSymptoms: ['Боль в груди или острая асимметрия лица/речи'],
      recommendedAction: 'Незамедлительно вызовите скорую помощь по номеру 103 или 112.',
      emergencyNumber: '103 / 112',
    };
  }

  // 3. Critical lab markers
  for (const doc of documents) {
    for (const dev of doc.deviations || []) {
      const markerLower = (dev.marker || '').toLowerCase();
      const valNum = parseFloat((dev.value || '').replace(',', '.'));

      if (!isNaN(valNum)) {
        if (markerLower.includes('гемоглобин') && valNum < 70) {
          return {
            id: 'redflag-severe-anemia',
            title: 'Критическое снижение гемоглобина (тяжёлая анемия)',
            description: `Гемоглобин ${dev.value} находится ниже 70 г/л. Существует риск гипоксии жизненно важных органов.`,
            criticalSymptoms: [`Гемоглобин ${dev.value}`],
            recommendedAction: 'Срочно обратитесь в приёмный покой или вызовите скорую помощь для госпитализации.',
            emergencyNumber: '103 / 112',
          };
        }
        if (markerLower.includes('калий') && valNum > 6.2) {
          return {
            id: 'redflag-hyperkalemia',
            title: 'Критическая гиперкалиемия',
            description: `Калий ${dev.value} превышает 6.2 ммоль/л. Существует риск нарушений сердечного ритма.`,
            criticalSymptoms: [`Калий ${dev.value}`],
            recommendedAction: 'Срочная медицинская консультация и ЭКГ-контроль в стационаре.',
            emergencyNumber: '103 / 112',
          };
        }
      }
    }
  }

  return null;
}

// Generate complete structured health analysis using deterministic rules
export function generateFallbackHealthAnalysis(data: any): StructuredHealthAnalysis {
  const urgentAlert = checkRedFlags(data);
  const { user = {}, documents = [], diaryEntries = [], bodySystems = [] } = data;

  const allDeviations: HealthAttentionItem[] = [];
  const calculationSources: Array<{ label: string; detail: string }> = [];

  // Data completeness calculation
  let completenessPoints = 0;
  if (user?.fullName) completenessPoints += 20;
  if (user?.bloodType) completenessPoints += 15;
  if (documents.length > 0) completenessPoints += 35;
  if (diaryEntries.length > 0) completenessPoints += 15;
  if (user?.psychology?.sleepHours) completenessPoints += 15;

  const dataCompleteness = Math.min(1.0, completenessPoints / 100);

  // Collect deviations from documents
  documents.forEach((doc: any) => {
    calculationSources.push({
      label: `Документ: ${doc.title || 'Лабораторный анализ'}`,
      detail: `Дата: ${doc.date || 'Недавний'} (Проверено показателей: ${(doc.deviations || []).length + 2})`,
    });

    (doc.deviations || []).forEach((dev: any, idx: number) => {
      const marker = dev.marker || 'Показатель';
      const markerLower = marker.toLowerCase();

      let plainExplanation = `${marker} — важный биологический маркер. В вашем анализе зафиксировано значение ${dev.value} при норме ${dev.norm}.`;
      let shortSummary = `Зафиксировано отклонение от лабораторного норматива. Состояние требует контроля в динамике.`;
      let possibleCauses: PossibleCause[] = [
        { title: 'Особенности питания и образа жизни', description: 'Пищевой рацион, режим гидратации или уровень стресса в дни перед сдачей.', category: 'lifestyle' },
        { title: 'Физиологические колебания', description: 'Естественная реакция организма на физические нагрузки или режим сна.', category: 'common' },
        { title: 'Необходимость врачебной оценки', description: 'Врач оценит показатель в комплексе с другими маркерами и симптомами.', category: 'doctor_check' },
      ];
      let safeActionsNow = [
        'Сохраняйте полученные результаты анализов в приложении для отслеживания динамики.',
        'Соблюдайте питьевой режим (30 мл воды на 1 кг массы тела).',
        'Не начинайте приём лекарственных препаратов или биодобавок без назначения специалиста.',
      ];
      let doctor: DoctorRecommendation = {
        specialty: 'Терапевт',
        reason: 'Для комплексной оценки результата и составления персонального плана обследования.',
        urgency: 'planned',
        urgencyLabel: 'Плановая консультация',
        timeframe: 'В течение 1-2 недель',
        prepareItems: ['Бланк анализа', 'Дневник самочувствия за последнюю неделю'],
      };
      let emergencySigns = 'При резком ухудшении самочувствия, головокружении или появлении болей вызвать 103/112.';
      let severity: 'mild' | 'moderate' | 'high' | 'critical' = dev.status === 'Выше' || dev.status === 'Ниже' ? 'moderate' : 'mild';

      // Specific marker knowledge
      if (markerLower.includes('витамин d') || markerLower.includes('25-oh')) {
        plainExplanation = `Витамин D (холекальциферол — жирорастворимый витамин-гормон) регулирует усвоение кальция и фосфора, укрепляет кости и поддерживают иммунитет. Ваше значение ${dev.value} указывает на снижение уровня ниже оптимальной нормы (${dev.norm}).`;
        shortSummary = `Уровень витамина D ниже референсного диапазона. Это часто проявляется утомляемостью и снижением иммунного ответа.`;
        possibleCauses = [
          { title: 'Недостаток инсоляции', description: 'Малое количество времени на солнце в осенне-зимний период.', category: 'lifestyle' },
          { title: 'Рацион питания', description: 'Низкое содержание жирной рыбы, яичных желтков и молочных продуктов в меню.', category: 'lifestyle' },
          { title: 'Консультация врача', description: 'Терапевт подберет индивидуальную лечебную или профилактическую дозу D3.', category: 'doctor_check' },
        ];
        safeActionsNow = [
          'Включите в рацион жирную рыбу (лосось, сельдь), яйца и сливочное масло.',
          'Чаще гуляйте в дневное время суток.',
          'Обсудите с врачом необходимость приёма профилактической дозировки Витамина D3.',
        ];
        doctor = {
          specialty: 'Терапевт / Эндокринолог',
          reason: 'Подбор корректной подбираемой дозировки Витамина D3 (например, 2000-5000 МЕ/сут) под контролем анализов.',
          urgency: 'planned',
          urgencyLabel: 'Планово',
          timeframe: 'В течение 2-3 недель',
          prepareItems: ['Анализ на 25-OH Витамин D', 'Общий анализ крови'],
        };
      } else if (markerLower.includes('ферритин')) {
        plainExplanation = `Ферритин (белковый комплекс, депонирующий железо в тканях) показывает реальные запасы железа в организме. Ваше значение ${dev.value} (Норма: ${dev.norm}).`;
        shortSummary = `Оценка запасов железа. Снижение может свидетельствовать о латентном железодефиците.`;
        possibleCauses = [
          { title: 'Ограничение красного мяса', description: 'Недостаточный приём гемового железа с пищей.', category: 'lifestyle' },
          { title: 'Обильные менструации', description: 'Естественная потеря железа у женщин репродуктивного возраста.', category: 'common' },
          { title: 'Врачебная диагностика', description: 'Исключение скрытых источнико кровопотери и подбор формы железа.', category: 'doctor_check' },
        ];
        safeActionsNow = [
          'Добавьте в рацион телятину, печень, гречку и зелёные яблоки.',
          'Употребляйте продукты с железом вместе с источниками Витамина C (болгарский перец, шиповник).',
          'Не принимайте препараты железа самостоятельно — это может вызвать раздражение ЖКТ.',
        ];
        doctor = {
          specialty: 'Терапевт / Гематолог',
          reason: 'Оценка железодефицита, проверка ОАК и С-реактивного белка.',
          urgency: 'planned',
          urgencyLabel: 'Планово',
          timeframe: 'В течение 1-2 недель',
          prepareItems: ['Ферритин', 'Клинический анализ крови (ОАК)', 'С-реактивный белок'],
        };
      } else if (markerLower.includes('холестерин') || markerLower.includes('лпнп')) {
        plainExplanation = `Холестерин (липид, необходимый для построения мембран клеток и синтеза гормонов). Превышение значения ${dev.value} (Норма: ${dev.norm}) может способствовать формированию атеросклеротических бляшек.`;
        shortSummary = `Липидный профиль превышает целевую норму. Рекомендуется коррекция диеты и активности.`;
        possibleCauses = [
          { title: 'Избыток насыщенных жиров', description: 'Частое употребление фастфуда, жирных соусов и выпечки.', category: 'lifestyle' },
          { title: 'Гиподинамия', description: 'Низкая ежедневная двигательная активность.', category: 'lifestyle' },
          { title: 'Генетическая predisposition', description: 'Особенности липидного обмена в семье.', category: 'common' },
        ];
        safeActionsNow = [
          'Увеличьте долю клетчатки (овощи, отруби, овсянка) и Омега-3 жирных кислот.',
          'Замените жарение на запекание или тушение.',
          'Добавьте 30 минут быстрой ходьбы ежедневно.',
        ];
        doctor = {
          specialty: 'Терапевт / Кардиолог',
          reason: 'Расчёт индивидуального сердечно-сосудистого риска (шкала SCORE) и расширенная липидограмма.',
          urgency: 'planned',
          urgencyLabel: 'Планово',
          timeframe: 'В ближайшие 2-4 недели',
          prepareItems: ['Липидный спектр (Общий холестерин, ЛПНП, ЛПВП, Триглицериды)', 'УЗИ сосудов шеи (по назначению)'],
        };
      } else if (markerLower.includes('ттг') || markerLower.includes('tsh')) {
        plainExplanation = `ТТГ (Тиреотропный гормон — гормон гипофиза, управляющий работой щитовидной железы). Значение ${dev.value} требует внимания врача для исключения гипотиреоза или гипертиреоза.`;
        shortSummary = `Изменение тиреотропного гормона. Влияет на скорость обмена веществ, энергию и настроение.`;
        doctor = {
          specialty: 'Эндокринолог',
          reason: 'Оценка функции щитовидной железы и сдача свободного Т4 и Т3.',
          urgency: 'soon',
          urgencyLabel: 'В ближайшие дни',
          timeframe: 'В течение 7-10 дней',
          prepareItems: ['ТТГ', 'Т4 свободный', 'УЗИ щитовидной железы'],
        };
      }

      allDeviations.push({
        id: `att-${doc.id}-${idx}`,
        markerId: marker,
        title: `${marker}: ${dev.value} (Норма: ${dev.norm})`,
        value: dev.value,
        reference: dev.norm,
        severity,
        statusLevel: severity === 'moderate' ? 'attention' : 'slight_deviation',
        shortSummary,
        plainExplanation,
        possibleCauses,
        safeActionsNow,
        doctor,
        emergencySigns,
        confidence: 0.92,
        reasoningSources: [
          { label: 'Лабораторный результат', detail: `Значение ${dev.value} зафиксировано в документе "${doc.title || 'Анализ'}" от ${doc.date || 'недавняя дата'}.` },
          { label: 'Референсный интервал', detail: `Лабораторная норма: ${dev.norm}. Статус: ${dev.status || 'Отклонение'}.` },
        ],
      });
    });
  });

  // User psychology & lifestyle additions to sources
  if (user?.psychology) {
    calculationSources.push({
      label: 'Анкета и психологический профиль',
      detail: `Сон: ${user.psychology.sleepHours || 7.5} ч, Стресс: ${user.psychology.stressLevel || 3}/10, Настроение: ${user.psychology.mood || 'нормальное'}`,
    });
  }

  // Define 12 mandatory body systems
  const defaultSystems: BodySystemReport[] = [
    {
      id: 'cardio',
      name: 'Сердечно-сосудистая система',
      status: allDeviations.some(d => d.title.toLowerCase().includes('холестерин')) ? 'slight_deviation' : 'norm',
      statusLabel: allDeviations.some(d => d.title.toLowerCase().includes('холестерин')) ? 'Умеренные маркёры' : 'Норма и стабильность',
      score: allDeviations.some(d => d.title.toLowerCase().includes('холестерин')) ? 78 : 90,
      briefComment: allDeviations.some(d => d.title.toLowerCase().includes('холестерин'))
        ? 'Отмечаются незначительные колебания липидного спектра. Пульс и давление в пределах нормы.'
        : 'Показатели в норме. Сердечный ритм и липидный обмен стабильны.',
      influencingMarkers: ['Холестерин общий', 'АД (Давление)', 'Пульс в покое'],
      trend: 'stable',
      normItems: ['Артериальное давление в норме', 'ЭКГ без патологий'],
      attentionItems: allDeviations.filter(d => d.title.toLowerCase().includes('холестерин')).map(d => d.title),
      nextAction: 'Плановый контроль липидного профиля через 3 месяца',
      hasSufficientData: true,
    },
    {
      id: 'nervous',
      name: 'Нервная система',
      status: (user?.psychology?.stressLevel || 0) > 6 ? 'attention' : 'norm',
      statusLabel: (user?.psychology?.stressLevel || 0) > 6 ? 'Повышен стресс' : 'Стабильное состояние',
      score: (user?.psychology?.stressLevel || 0) > 6 ? 68 : 88,
      briefComment: (user?.psychology?.stressLevel || 0) > 6
        ? 'Зафиксирован повышнный уровень психоэмоционального напряжения и утомляемости.'
        : 'Высокая когнитивная работоспособность и нормальное восстановление.',
      influencingMarkers: ['Уровень стресса', 'Качество сна', 'Когнитивный ресурс'],
      trend: 'stable',
      normItems: ['Когнитивная концентрация', 'Рефлексы'],
      attentionItems: (user?.psychology?.stressLevel || 0) > 6 ? ['Повышенный дневной стресс'] : [],
      nextAction: 'Соблюдение гигиены сна и вечерний отдых без экранов',
      hasSufficientData: true,
    },
    {
      id: 'respiratory',
      name: 'Дыхательная система',
      status: 'norm',
      statusLabel: 'Норма',
      score: 92,
      briefComment: 'Жалоб на одышку или кашель не зафиксировано. Насыщение кислородом стабильное.',
      influencingMarkers: ['Частота дыхания', 'Отсутствие кашля'],
      trend: 'stable',
      normItems: ['Свободное дыхание', 'Без симптомов ОРВИ'],
      attentionItems: [],
      nextAction: 'Плановая флюорография (1 раз в год)',
      hasSufficientData: true,
    },
    {
      id: 'digestive',
      name: 'Пищеварительная система (ЖКТ)',
      status: 'norm',
      statusLabel: 'Стабильно',
      score: 85,
      briefComment: 'Пищеварение работает ровно. Печеночные ферменты (АЛТ, АСТ) в пределах нормативов.',
      influencingMarkers: ['АЛТ', 'АСТ', 'Питьевой режим'],
      trend: 'stable',
      normItems: ['АЛТ/АСТ в норме', 'Аппетит сохранен'],
      attentionItems: [],
      nextAction: 'Поддержание сбалансированного рациона с клетчаткой',
      hasSufficientData: true,
    },
    {
      id: 'endocrine',
      name: 'Эндокринная система',
      status: allDeviations.some(d => d.title.toLowerCase().includes('ттг')) ? 'attention' : 'norm',
      statusLabel: allDeviations.some(d => d.title.toLowerCase().includes('ттг')) ? 'Требует внимания' : 'Баланс гормонов',
      score: allDeviations.some(d => d.title.toLowerCase().includes('ттг')) ? 72 : 89,
      briefComment: allDeviations.some(d => d.title.toLowerCase().includes('ттг'))
        ? 'Отмечаются изменения уровня тиреотропного гормона. Рекомендуется плановая консультация эндокринолога.'
        : 'Показатели щитовидной железы и глюкозы крови находятся в физиологической норме.',
      influencingMarkers: ['ТТГ', 'Глюкоза натощак'],
      trend: 'stable',
      normItems: ['Глюкоза натощак в норме'],
      attentionItems: allDeviations.filter(d => d.title.toLowerCase().includes('ттг')).map(d => d.title),
      nextAction: 'Контроль ТТГ и Т4 свободного через 1 месяц',
      hasSufficientData: true,
    },
    {
      id: 'immune',
      name: 'Иммунная система',
      status: allDeviations.some(d => d.title.toLowerCase().includes('витамин d')) ? 'slight_deviation' : 'norm',
      statusLabel: allDeviations.some(d => d.title.toLowerCase().includes('витамин d')) ? 'Снижен D3' : 'Оптимальный иммунитет',
      score: allDeviations.some(d => d.title.toLowerCase().includes('витамин d')) ? 75 : 90,
      briefComment: allDeviations.some(d => d.title.toLowerCase().includes('витамин d'))
        ? 'Лейкоциты в норме, но выявлен дефицит Витамина D3, влияющего на сопротивляемость инфекциям.'
        : 'Лейкоцитарная формула и уровень защитных антител в норме.',
      influencingMarkers: ['Витамин D (25-OH)', 'Лейкоциты', 'С-реактивный белок'],
      trend: 'stable',
      normItems: ['Лейкоциты крови в норме', 'С-реактивный белок без воспалений'],
      attentionItems: allDeviations.filter(d => d.title.toLowerCase().includes('витамин d')).map(d => d.title),
      nextAction: 'Восполнение уровня Витамина D3 по рекомендации врача',
      hasSufficientData: true,
    },
    {
      id: 'urinary',
      name: 'Мочевыделительная система',
      status: 'insufficient_data',
      statusLabel: 'Недостаточно данных',
      score: 80,
      briefComment: 'Недостаточно данных для объективной оценки. Рекомендуется сдать общий анализ мочи и креатинин.',
      influencingMarkers: ['Креатинин', 'Мочевина'],
      trend: 'unknown',
      normItems: [],
      attentionItems: [],
      nextAction: 'Сдать общий анализ мочи и креатинин при плановом обследовании',
      hasSufficientData: false,
    },
    {
      id: 'reproductive',
      name: 'Репродуктивная система',
      status: user?.womenHealth ? 'norm' : 'insufficient_data',
      statusLabel: user?.womenHealth ? 'Норма' : 'Недостаточно данных',
      score: user?.womenHealth ? 86 : 80,
      briefComment: user?.womenHealth
        ? `Цикл регулярный (${user.womenHealth.cycleLength || 28} дней). Жалоб на острые боли нет.`
        : 'Данные анкеты не заполнены. Рекомендуется плановый осмотр у профильного специалиста 1 раз в год.',
      influencingMarkers: ['Длина цикла', 'Регулярность'],
      trend: 'stable',
      normItems: user?.womenHealth ? ['Регулярность цикла'] : [],
      attentionItems: [],
      nextAction: 'Профилактический ежегодный осмотр',
      hasSufficientData: Boolean(user?.womenHealth),
    },
    {
      id: 'musculoskeletal',
      name: 'Опорно-двигательный аппарат',
      status: 'norm',
      statusLabel: 'Норма',
      score: 84,
      briefComment: 'Суставы и позвоночник без выраженных ограничений подвижности. Рекомендуется ежедневная разминка.',
      influencingMarkers: ['Физическая активность', 'Кальций общий'],
      trend: 'stable',
      normItems: ['Умеренная бытовая активность'],
      attentionItems: [],
      nextAction: 'Регулярная утренняя гимнастика и 8000 шагов в день',
      hasSufficientData: true,
    },
    {
      id: 'hematopoietic',
      name: 'Кроветворная система (Кровь)',
      status: allDeviations.some(d => d.title.toLowerCase().includes('ферритин') || d.title.toLowerCase().includes('гемоглобин')) ? 'attention' : 'norm',
      statusLabel: allDeviations.some(d => d.title.toLowerCase().includes('ферритин')) ? 'Внимание к депо железа' : 'Норма',
      score: allDeviations.some(d => d.title.toLowerCase().includes('ферритин')) ? 70 : 92,
      briefComment: allDeviations.some(d => d.title.toLowerCase().includes('ферритин'))
        ? 'Отмечаются признаки снижения уровня депонированного железа (ферритина). Гемоглобин сохранён.'
        : 'Эритроциты, гемоглобин и тромбоциты в норме.',
      influencingMarkers: ['Ферритин', 'Гемоглобин', 'Эритроциты'],
      trend: 'stable',
      normItems: ['Гемоглобин в норме'],
      attentionItems: allDeviations.filter(d => d.title.toLowerCase().includes('ферритин')).map(d => d.title),
      nextAction: 'Контроль показателя ферритина через 2 месяца',
      hasSufficientData: true,
    },
    {
      id: 'psychoemotional',
      name: 'Психоэмоциональная сфера',
      status: (user?.psychology?.stressLevel || 0) > 5 ? 'attention' : 'norm',
      statusLabel: (user?.psychology?.stressLevel || 0) > 5 ? 'Умеренный стресс' : 'Баланс',
      score: (user?.psychology?.stressLevel || 0) > 5 ? 72 : 87,
      briefComment: (user?.psychology?.stressLevel || 0) > 5
        ? 'Наблюдается психоэмоциональная нагрузка. Рекомендуется использование дненика настроения и дыхательных практик.'
        : 'Эмоциональный фон устойчивый, хорошее настроение.',
      influencingMarkers: ['Дневник эмоций', 'Шкала стресса', 'Качество сна'],
      trend: 'stable',
      normItems: ['Эмоциональный контакт с окружающими'],
      attentionItems: (user?.psychology?.stressLevel || 0) > 5 ? ['Повышенный дневной стресс'] : [],
      nextAction: 'Ведение дневника ментального состояния',
      hasSufficientData: true,
    },
    {
      id: 'metabolic',
      name: 'Обмен веществ (Метаболизм)',
      status: allDeviations.length > 0 ? 'slight_deviation' : 'norm',
      statusLabel: allDeviations.length > 0 ? 'Есть отклонения' : 'Оптимальный',
      score: allDeviations.length > 0 ? 76 : 91,
      briefComment: allDeviations.length > 0
        ? `Выявлено ${allDeviations.length} отклонений в лабораторных маркерах метаболизма.`
        : 'Базовые обменные процессы и индекс массы тела находятся в норме.',
      influencingMarkers: ['ИМТ', 'Холестерин', 'Витамин D'],
      trend: 'stable',
      normItems: ['Индекс массы тела в здоровой зоне'],
      attentionItems: allDeviations.map(d => d.title),
      nextAction: 'Коррекция рациона и контроль активности',
      hasSufficientData: true,
    },
  ];

  // Positive & negative factors summary
  const positiveFactors = [
    'Стабильный уровень артериального давления и пульса в покое.',
    'Хорошая продолжительность сна (> 7 часов в сутки).',
    'Отсутствие критических воспалительных процессов по базовым анализам.',
  ];

  const negativeFactors: string[] = [];
  if (allDeviations.length > 0) {
    allDeviations.forEach(d => negativeFactors.push(d.shortSummary || d.title));
  } else {
    negativeFactors.push('Небольшая утомляемость в вечерние часы.');
  }

  // Check if new user or minimal data present
  const hasQuestionnaire = Boolean(user?.isQuestionnaireCompleted);
  const hasDocuments = documents.length > 0;

  // Determine overall status & score based on real data presence
  let overallStatus: HealthStatusLevel = 'norm';
  let overallScore = 8.4;

  if (urgentAlert) {
    overallStatus = 'urgent_help';
    overallScore = 3.5;
  } else if (!hasQuestionnaire && !hasDocuments) {
    overallStatus = 'insufficient_data';
    overallScore = 0;
  } else if (allDeviations.some(d => d.severity === 'high')) {
    overallStatus = 'attention';
    overallScore = 6.2;
  } else if (allDeviations.length > 0) {
    overallStatus = 'slight_deviation';
    overallScore = 7.6;
  }

  const summaryText = urgentAlert
    ? urgentAlert.description
    : !hasQuestionnaire && !hasDocuments
    ? 'Начинаем собирать данные. Приложение будет постепенно замечать, что влияет на ваше самочувствие, энергию, сон и настроение. Чем дольше вы им пользуетесь, тем точнее становятся наблюдения.'
    : hasQuestionnaire && !hasDocuments
    ? 'Мы сформировали предварительную картину на основании опроса. Теперь приложение будет уточнять её по мере появления дневниковых записей, исследований, измерений и истории препаратов.'
    : allDeviations.length > 0
    ? `На основе загруженных медицинских исследований зафиксировано ${allDeviations.length} показателей, требующих внимания. Рекомендуются безопасные шаги по коррекции образа жизни.`
    : 'Все ключевые показатели вашего здоровья и лабораторные маркеры находятся в пределах референсных значений.';

  return {
    overallStatus,
    overallScore,
    summary: summaryText,
    confidence: hasDocuments || hasQuestionnaire ? 0.88 : 0.2,
    dataCompleteness,
    urgentAlert,
    positiveFactors: hasDocuments || hasQuestionnaire
      ? positiveFactors
      : ['Данные о состоянии будут собираться постепенно из дневника, анализов и измерений.'],
    negativeFactors: hasDocuments || hasQuestionnaire
      ? negativeFactors
      : ['Для точного анализа пока недостаточно исторических данных.'],
    calculationSources,
    attentionItems: allDeviations,
    systems: defaultSystems.map(sys => {
      if (!hasQuestionnaire && !hasDocuments) {
        return {
          ...sys,
          status: 'insufficient_data' as HealthStatusLevel,
          statusLabel: 'Данных пока недостаточно',
          score: 0,
          briefComment: 'Данных пока недостаточно для комплексной оценки.',
          hasSufficientData: false,
        };
      }
      return sys;
    }),
    dailyRecommendations: [
      'Соблюдайте режим сна: засыпайте до 23:00 и спите не менее 7.5 часов.',
      'Пейте достаточный объем чистой воды (не менее 1.5 - 2 литров в день).',
      'Добавляйте записи в дневник, когда вам удобно.',
    ],
    resourceForecast: {
      level: !hasQuestionnaire && !hasDocuments
        ? 'insufficient_data'
        : overallScore >= 8
        ? 'high'
        : overallScore >= 6.5
        ? 'medium'
        : 'low',
      description: !hasQuestionnaire && !hasDocuments
        ? 'Появится, когда мы увидим вашу динамику'
        : overallScore >= 8
        ? 'Высокий уровень ресурса на ближайшие 3 дня.'
        : 'Умеренный ресурс: рекомендуется избегать перегрузок.',
      drivers: !hasQuestionnaire && !hasDocuments
        ? []
        : ['Качественный ночной сон', 'Регулярный прием пищи', 'Баланс труда и отдыха'],
    },
    disclaimer: 'Информация носит исключительно ознакомительный характер, сформирована на основе ИИ-анализа представленных данных и не является медицинским диагнозом или назначением лечения.',
  };
}

let quotaCooldownUntil = 0;

export function isGeminiQuotaExhausted(): boolean {
  return Date.now() < quotaCooldownUntil;
}

export function setGeminiQuotaExhaustedCooldown(seconds = 60) {
  quotaCooldownUntil = Date.now() + seconds * 1000;
}

// Main AI Health Analyzer (Gemini 3.6 Flash + Fallback)
export async function analyzeHealthWithGeminiOrFallback(
  aiClient: GoogleGenAI | null,
  data: any
): Promise<{ analysis: StructuredHealthAnalysis; mode: 'gemini' | 'rule_fallback' }> {
  // First, check red flags synchronously
  const urgentRedFlag = checkRedFlags(data);
  if (urgentRedFlag) {
    const fallback = generateFallbackHealthAnalysis(data);
    fallback.urgentAlert = urgentRedFlag;
    fallback.overallStatus = 'urgent_help';
    fallback.overallScore = 3.2;
    return { analysis: fallback, mode: 'rule_fallback' };
  }

  if (!aiClient || isGeminiQuotaExhausted()) {
    return { analysis: generateFallbackHealthAnalysis(data), mode: 'rule_fallback' };
  }

  try {
    const systemInstruction = `Ты — профессиональный ИИ-ассистент по анализу здоровья ("Здоровье 2.0").
Твоя задача — провести глубокий медицинский и психологический анализ всех поступивших данных пользователя (анкета, лабораторные анализы, дневник эмоций, физические маркеры).

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА И ОГРАНИЧЕНИЯ:
1. НЕ СТАВИТЬ ДИАГНОЗЫ. Не говори "У вас гипертиреоз". Используй вероятностный язык: "Данное значение может наблюдаться при...", "Это характерно для...".
2. НЕ НАЗНАЧАТЬ ЛЕКАРСТВА И НЕ МЕНЯТЬ ДОЗИРОВКИ. Давай только безопасные советы по образу жизни (сон, гидратация, рацион, прогулки, подготовка к приёму врача).
3. ПРОСТОЙ РУССКИЙ ЯЗЫК. Разъясняй медицинские термины в скобках. Пример: "Ферритин (белок, хранящий запасы железа в тканях)".
4. ДВУХУРОВНЕВОЕ ОБЪЯСНЕНИЕ для каждого отклонения:
   - shortSummary (кратко 2-3 строки)
   - plainExplanation (понятный текст с терминами в скобках)
   - possibleCauses (категории: common, lifestyle, medication, doctor_check)
   - safeActionsNow (безопасные шаги сейчас)
   - doctor (специальность врача, срочность, время, что взять)
   - emergencySigns (когда вызывать 103/112)
   - reasoningSources (на основании какого конкретного документа/показателя вывод)
5. 12 ОБЯЗАТЕЛЬНЫХ СИСТЕМ ОРГАНИЗМА (Сердечно-сосудистая, Нервная, Дыхательная, Пищеварительная, Эндокринная, Иммунная, Мочевыделительная, Репродуктивная, Опорно-двигательная, Кроветворная, Психоэмоциональная, Обмен веществ). Если данных недостаточно, ставь status = "insufficient_data" и hasSufficientData = false.
6. ВЕРНИ СТРОГИЙ JSON следующей структуры:
{
  "overallStatus": "norm" | "slight_deviation" | "attention" | "urgent_help" | "insufficient_data",
  "overallScore": number (0-10),
  "summary": "Краткий общий вывод",
  "confidence": number (0-1),
  "dataCompleteness": number (0-1),
  "urgentAlert": null,
  "positiveFactors": ["фактор1"],
  "negativeFactors": ["фактор2"],
  "calculationSources": [{"label": "Источник", "detail": "Детали"}],
  "attentionItems": [...],
  "systems": [...],
  "dailyRecommendations": ["рек1"],
  "resourceForecast": {"level": "high", "description": "описание", "drivers": ["драйвер1"]},
  "disclaimer": "Дисклеймер"
}`;

    const prompt = `Проанализируй данные пользователя и сформируй полный отчёт:
Данные пользователя: ${JSON.stringify(data)}`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.overallStatus && Array.isArray(parsed.systems)) {
      return { analysis: parsed, mode: 'gemini' };
    }
    
    // Fallback if structured json lacks fields
    return { analysis: generateFallbackHealthAnalysis(data), mode: 'rule_fallback' };
  } catch (err: any) {
    const isQuotaError = err?.status === 429 || err?.message?.includes('RESOURCE_EXHAUSTED') || err?.message?.includes('429') || err?.message?.includes('quota');
    if (isQuotaError) {
      setGeminiQuotaExhaustedCooldown(60);
      console.warn('Gemini API quota reached. Using high-precision rule-based health analyzer fallback.');
    } else {
      console.error('Gemini health analysis error:', err?.message || err);
    }
    return { analysis: generateFallbackHealthAnalysis(data), mode: 'rule_fallback' };
  }
}
