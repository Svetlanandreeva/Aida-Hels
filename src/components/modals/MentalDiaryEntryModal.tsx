import React, { useState } from 'react';
import { X, Sparkles, Clock, AlertTriangle, UserPlus, Trash2, Heart, Shield, Check, Activity, Moon, Coffee, HeartPulse } from 'lucide-react';
import { DiaryEntry, MoodType, EventCategory, UserReaction, HelpfulAction, RelatedPerson, PhysicalFactors } from '../../types';

interface MentalDiaryEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Partial<DiaryEntry>) => void;
  initialEntry?: DiaryEntry | null;
  initialType?: 'quick' | 'full';
}

const PRESET_MOODS: MoodType[] = [
  'спокойствие',
  'радость',
  'вдохновение',
  'уверенность',
  'удовлетворение',
  'тревога',
  'раздражение',
  'грусть',
  'апатия',
  'усталость',
  'одиночество',
  'чувство вины',
  'злость',
  'страх',
  'эмоциональное перенапряжение',
];

const CATEGORIES: EventCategory[] = [
  'работа',
  'учёба',
  'отношения',
  'семья',
  'друзья',
  'здоровье',
  'финансы',
  'отдых',
  'сон',
  'питание',
  'физическая активность',
  'социальные сети',
  'одиночество',
  'домашние дела',
  'другое',
];

const REACTIONS: UserReaction[] = [
  'начал работать',
  'отложил дела',
  'лёг спать',
  'поел',
  'пошёл гулять',
  'поговорил с кем-то',
  'остался один',
  'начал листать социальные сети',
  'заплакал',
  'разозлился',
  'занялся спортом',
  'использовал алкоголь или другие вещества',
  'другое',
];

const HELPFUL_ACTIONS: HelpfulAction[] = [
  'сон',
  'отдых',
  'прогулка',
  'музыка',
  'разговор',
  'поддержка близкого',
  'еда',
  'спорт',
  'творчество',
  'дыхательные упражнения',
  'время в одиночестве',
  'ничего не помогло',
  'другое',
];

export const MentalDiaryEntryModal: React.FC<MentalDiaryEntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialEntry,
  initialType = 'full',
}) => {
  if (!isOpen) return null;

  const [entryType, setEntryType] = useState<'quick' | 'full'>(
    initialEntry ? initialEntry.entry_type : initialType
  );

  // Form State
  const nowStr = new Date().toISOString().slice(0, 16);
  const [eventDatetime, setEventDatetime] = useState<string>(
    initialEntry?.event_datetime || nowStr
  );
  const [stateScore, setStateScore] = useState<number>(initialEntry?.state_score || 7);
  const [energyScore, setEnergyScore] = useState<number>(initialEntry?.energy_score || 7);
  const [anxietyScore, setAnxietyScore] = useState<number>(initialEntry?.anxiety_score || 3);
  const [stressScore, setStressScore] = useState<number>(initialEntry?.stress_score || 3);
  const [tensionScore, setTensionScore] = useState<number>(initialEntry?.tension_score || 3);

  const [selectedMoods, setSelectedMoods] = useState<string[]>(initialEntry?.moods || ['спокойствие']);
  const [customMoodInput, setCustomMoodInput] = useState<string>('');
  
  const [selectedCategories, setSelectedCategories] = useState<EventCategory[]>(
    initialEntry?.event_categories || ['работа']
  );
  const [eventDescription, setEventDescription] = useState<string>(
    initialEntry?.event_description || ''
  );

  const [thoughts, setThoughts] = useState<string>(initialEntry?.thoughts || '');
  const [selectedReactions, setSelectedReactions] = useState<string[]>(
    initialEntry?.user_reactions || []
  );
  const [reactionComment, setReactionComment] = useState<string>(
    initialEntry?.reaction_comment || ''
  );
  const [selectedHelpful, setSelectedHelpful] = useState<string[]>(
    initialEntry?.helpful_actions || []
  );
  const [helpfulComment, setHelpfulComment] = useState<string>(
    initialEntry?.helpful_comment || ''
  );

  // People
  const [relatedPeople, setRelatedPeople] = useState<RelatedPerson[]>(
    initialEntry?.related_people || []
  );
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonRole, setNewPersonRole] = useState<RelatedPerson['role']>('коллега');

  // Physical factors
  const [sleepHours, setSleepHours] = useState<number>(
    initialEntry?.physical_factors?.sleepDurationHours || 7.5
  );
  const [sleepQuality, setSleepQuality] = useState<number>(
    initialEntry?.physical_factors?.sleepQualityScore || 7
  );
  const [foodStatus, setFoodStatus] = useState<PhysicalFactors['foodStatus']>(
    initialEntry?.physical_factors?.foodStatus || 'полноценный приём'
  );
  const [activityLevel, setActivityLevel] = useState<PhysicalFactors['physicalActivityLevel']>(
    initialEntry?.physical_factors?.physicalActivityLevel || 'умеренная'
  );
  const [hasDiscomfort, setHasDiscomfort] = useState<boolean>(
    initialEntry?.physical_factors?.hasPainOrDiscomfort || false
  );
  const [discomfortDetails, setDiscomfortDetails] = useState<string>(
    initialEntry?.physical_factors?.painDescription || ''
  );
  const [caffeine, setCaffeine] = useState<boolean>(
    initialEntry?.physical_factors?.caffeineConsumed || false
  );
  const [alcohol, setAlcohol] = useState<boolean>(
    initialEntry?.physical_factors?.alcoholConsumed || false
  );

  const [additionalNote, setAdditionalNote] = useState<string>(
    initialEntry?.additional_note || ''
  );

  const toggleMood = (mood: string) => {
    if (selectedMoods.includes(mood)) {
      setSelectedMoods(selectedMoods.filter((m) => m !== mood));
    } else {
      setSelectedMoods([...selectedMoods, mood]);
    }
  };

  const addCustomMood = () => {
    const trimmed = customMoodInput.trim();
    if (trimmed && !selectedMoods.includes(trimmed)) {
      setSelectedMoods([...selectedMoods, trimmed]);
      setCustomMoodInput('');
    }
  };

  const toggleCategory = (cat: EventCategory) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const toggleReaction = (r: string) => {
    if (selectedReactions.includes(r)) {
      setSelectedReactions(selectedReactions.filter((x) => x !== r));
    } else {
      setSelectedReactions([...selectedReactions, r]);
    }
  };

  const toggleHelpful = (h: string) => {
    if (selectedHelpful.includes(h)) {
      setSelectedHelpful(selectedHelpful.filter((x) => x !== h));
    } else {
      setSelectedHelpful([...selectedHelpful, h]);
    }
  };

  const addPerson = () => {
    if (!newPersonName.trim()) return;
    setRelatedPeople([
      ...relatedPeople,
      {
        id: 'p-' + Date.now(),
        name: newPersonName.trim(),
        role: newPersonRole,
      },
    ]);
    setNewPersonName('');
  };

  const removePerson = (id: string) => {
    setRelatedPeople(relatedPeople.filter((p) => p.id !== id));
  };

  const getStateScoreColor = (score: number) => {
    if (score >= 8) return 'from-emerald-500 to-teal-600 text-emerald-400';
    if (score >= 6) return 'from-teal-500 to-cyan-600 text-cyan-400';
    if (score >= 4) return 'from-amber-500 to-orange-600 text-amber-400';
    return 'from-rose-500 to-red-600 text-rose-400';
  };

  const getStateEmoji = (score: number) => {
    if (score >= 9) return '😀 (Отлично)';
    if (score >= 8) return '🙂 (Хорошо)';
    if (score >= 6) return '😐 (Нормально)';
    if (score >= 4) return '🙁 (Подавленно)';
    return '😣 (Тяжело)';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: Partial<DiaryEntry> = {
      id: initialEntry ? initialEntry.id : 'entry-' + Date.now(),
      entry_type: entryType,
      event_datetime: eventDatetime,
      state_score: stateScore,
      energy_score: energyScore,
      anxiety_score: entryType === 'full' ? anxietyScore : undefined,
      stress_score: entryType === 'full' ? stressScore : undefined,
      tension_score: entryType === 'full' ? tensionScore : undefined,
      moods: selectedMoods.length > 0 ? selectedMoods : ['нейтральное'],
      event_categories: entryType === 'full' ? selectedCategories : undefined,
      event_description: eventDescription,
      thoughts: entryType === 'full' ? thoughts : undefined,
      user_reactions: entryType === 'full' ? selectedReactions : undefined,
      reaction_comment: reactionComment,
      helpful_actions: entryType === 'full' ? selectedHelpful : undefined,
      helpful_comment: helpfulComment,
      related_people: entryType === 'full' ? relatedPeople : undefined,
      physical_factors:
        entryType === 'full'
          ? {
              sleepDurationHours: sleepHours,
              sleepQualityScore: sleepQuality,
              foodStatus,
              physicalActivityLevel: activityLevel,
              hasPainOrDiscomfort: hasDiscomfort,
              painDescription: hasDiscomfort ? discomfortDetails : undefined,
              caffeineConsumed: caffeine,
              alcoholConsumed: alcohol,
            }
          : undefined,
      additional_note: additionalNote,
    };

    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl my-8 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Heart className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {initialEntry ? 'Редактировать запись' : 'Зафиксировать состояние'}
              </h2>
              <p className="text-xs text-slate-400">
                Дневник ментального здоровья и анализа эмоционального ресурса
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Entry Mode Switcher */}
        <div className="px-6 pt-4 bg-slate-950/40 border-b border-slate-800 flex gap-2">
          <button
            type="button"
            onClick={() => setEntryType('full')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl flex items-center gap-2 border-t border-x transition ${
              entryType === 'full'
                ? 'bg-slate-900 text-teal-400 border-slate-700 font-bold'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            📝 Полная запись (детальный разбор)
          </button>
          <button
            type="button"
            onClick={() => setEntryType('quick')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl flex items-center gap-2 border-t border-x transition ${
              entryType === 'quick'
                ? 'bg-slate-900 text-teal-400 border-slate-700 font-bold'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            ⚡ Быстрая запись (30 секунд)
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Date & Time */}
          <div className="flex items-center gap-3 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
            <Clock className="w-4 h-4 text-teal-400" />
            <label className="text-xs text-slate-300 font-medium whitespace-nowrap">
              Дата и время ситуации:
            </label>
            <input
              type="datetime-local"
              value={eventDatetime}
              onChange={(e) => setEventDatetime(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500 ml-auto"
            />
          </div>

          {/* Core State Slider 1-10 */}
          <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-semibold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-400" />
                  Как ты себя сейчас чувствуешь? (Общая оценка)
                </label>
                <p className="text-xs text-slate-400 mt-0.5">
                  1 — На грани истощения / Сильный дискомфорт | 10 — Отличное ресурсное состояние
                </p>
              </div>
              <span className={`text-lg font-black px-3 py-1 rounded-xl bg-slate-900 border border-slate-700 ${getStateScoreColor(stateScore)}`}>
                {stateScore} / 10
              </span>
            </div>

            <div className="space-y-1">
              <input
                type="range"
                min={1}
                max={10}
                value={stateScore}
                onChange={(e) => setStateScore(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-medium pt-1">
                <span>1 (Крайне тяжело)</span>
                <span className="font-semibold text-teal-400">{getStateEmoji(stateScore)}</span>
                <span>10 (Пик ресурса)</span>
              </div>
            </div>
          </div>

          {/* Energy Slider 1-10 */}
          <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-semibold text-white flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-cyan-400" />
                  Сколько у тебя сейчас сил? (Уровень энергии)
                </label>
                <p className="text-xs text-slate-400 mt-0.5">
                  1 — Полная апатия / Нет сил двигаться | 10 — Огромный запас жизненных сил
                </p>
              </div>
              <span className="text-sm font-bold text-cyan-400 px-3 py-1 rounded-xl bg-slate-900 border border-slate-700">
                {energyScore} / 10
              </span>
            </div>

            <input
              type="range"
              min={1}
              max={10}
              value={energyScore}
              onChange={(e) => setEnergyScore(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          {/* Mood Selection */}
          <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 space-y-3">
            <label className="text-sm font-semibold text-white block">
              Выбери эмоции и оттенки настроения:
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_MOODS.map((mood) => {
                const isSelected = selectedMoods.includes(mood);
                return (
                  <button
                    type="button"
                    key={mood}
                    onClick={() => toggleMood(mood)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
                      isSelected
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-sm'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {isSelected && '✓ '}
                    {mood}
                  </button>
                );
              })}
            </div>

            {/* Custom Mood input */}
            <div className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="Добавить свой вариант эмоции..."
                value={customMoodInput}
                onChange={(e) => setCustomMoodInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomMood();
                  }
                }}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
              />
              <button
                type="button"
                onClick={addCustomMood}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition"
              >
                Добавить
              </button>
            </div>
          </div>

          {/* Event description */}
          <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 space-y-3">
            <label className="text-sm font-semibold text-white block">
              Что произошло перед тем, как изменилось состояние?
            </label>
            <textarea
              rows={3}
              placeholder="Опиши коротко ситуацию, разговор, мысли или физическое ощущение..."
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
            />

            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[11px] text-slate-500 font-medium py-1">Быстрые подсказки:</span>
              {[
                'Срочный дедлайн',
                'Прогулка на воздухе',
                'Разговор с руководителем',
                'Конфликт в семье',
                'Занятие спортом',
                'Встреча с друзьями',
                'Плохой сон',
                'Кофеин',
              ].map((chip) => (
                <button
                  type="button"
                  key={chip}
                  onClick={() =>
                    setEventDescription((prev) => (prev ? `${prev}. ${chip}` : chip))
                  }
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400 hover:text-teal-300 hover:border-teal-500/40 transition"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>

          {/* FULL MODE EXTENSIONS */}
          {entryType === 'full' && (
            <>
              {/* Anxiety, Stress, Tension Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80">
                {/* Anxiety */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-300">Тревожность</span>
                    <span className="font-bold text-amber-400">{anxietyScore} / 10</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={anxietyScore}
                    onChange={(e) => setAnxietyScore(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                </div>

                {/* Stress */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-300">Стресс</span>
                    <span className="font-bold text-rose-400">{stressScore} / 10</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={stressScore}
                    onChange={(e) => setStressScore(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
                  />
                </div>

                {/* Tension */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-300">Внутреннее напряжение</span>
                    <span className="font-bold text-indigo-400">{tensionScore} / 10</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={tensionScore}
                    onChange={(e) => setTensionScore(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                  />
                </div>
              </div>

              {/* Event Categories */}
              <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 space-y-3">
                <label className="text-sm font-semibold text-white block">
                  Категория сферы жизни:
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategories.includes(cat);
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
                          isSelected
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {isSelected && '✓ '}
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Related People */}
              <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 space-y-3">
                <label className="text-sm font-semibold text-white block">
                  Был ли кто-то связан с этой ситуацией? (Люди / контакты)
                </label>

                {relatedPeople.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {relatedPeople.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-200"
                      >
                        <span>
                          {p.name} <span className="text-slate-500">({p.role})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removePerson(p.id)}
                          className="text-slate-500 hover:text-rose-400 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Имя или инициалы (например, Александр)"
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                  <select
                    value={newPersonRole}
                    onChange={(e) => setNewPersonRole(e.target.value as any)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-teal-500"
                  >
                    <option value="партнёр">Партнёр</option>
                    <option value="руководитель">Руководитель</option>
                    <option value="коллега">Коллега</option>
                    <option value="мама">Мама</option>
                    <option value="папа">Папа</option>
                    <option value="друг">Друг</option>
                    <option value="родственник">Родственник</option>
                    <option value="знакомый">Знакомый</option>
                    <option value="другое">Другое</option>
                  </select>
                  <button
                    type="button"
                    onClick={addPerson}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Добавить
                  </button>
                </div>
              </div>

              {/* Thoughts */}
              <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 space-y-3">
                <label className="text-sm font-semibold text-white block">
                  Какие мысли появились в этот момент?
                </label>
                <textarea
                  rows={2}
                  placeholder="Автоматические мысли, установки или сомнения..."
                  value={thoughts}
                  onChange={(e) => setThoughts(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>

              {/* Reactions */}
              <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 space-y-3">
                <label className="text-sm font-semibold text-white block">
                  Что ты сделал(а) после этого? (Реакции и действия):
                </label>
                <div className="flex flex-wrap gap-2">
                  {REACTIONS.map((r) => {
                    const isSelected = selectedReactions.includes(r);
                    return (
                      <button
                        type="button"
                        key={r}
                        onClick={() => toggleReaction(r)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
                          isSelected
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {isSelected && '✓ '}
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* What helped */}
              <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 space-y-3">
                <label className="text-sm font-semibold text-white block">
                  Что помогло почувствовать себя лучше?
                </label>
                <div className="flex flex-wrap gap-2">
                  {HELPFUL_ACTIONS.map((h) => {
                    const isSelected = selectedHelpful.includes(h);
                    return (
                      <button
                        type="button"
                        key={h}
                        onClick={() => toggleHelpful(h)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {isSelected && '✓ '}
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Physical Factors */}
              <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 space-y-4">
                <label className="text-sm font-semibold text-white flex items-center gap-2">
                  <Moon className="w-4 h-4 text-indigo-400" />
                  Физиологические факторы и сон:
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Sleep duration */}
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400">Продолжительность сна (часы):</span>
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      max={24}
                      value={sleepHours}
                      onChange={(e) => setSleepHours(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {/* Sleep quality */}
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400">Качество сна (1-10):</span>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={sleepQuality}
                      onChange={(e) => setSleepQuality(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400 mt-2"
                    />
                  </div>

                  {/* Food status */}
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400">Питание за сегодня:</span>
                    <select
                      value={foodStatus}
                      onChange={(e) => setFoodStatus(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-teal-500"
                    >
                      <option value="полноценный приём">Полноценный регулярный приём</option>
                      <option value="перекус">Перекусы на бегу</option>
                      <option value="пропустил приём">Пропустил приём пищи</option>
                      <option value="переедание">Переедание</option>
                    </select>
                  </div>

                  {/* Physical activity */}
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400">Физическая активность:</span>
                    <select
                      value={activityLevel}
                      onChange={(e) => setActivityLevel(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-teal-500"
                    >
                      <option value="активная">Активная (тренировка / спорт)</option>
                      <option value="умеренная">Умеренная (прогулка / шаги)</option>
                      <option value="низкая">Низкая (сидячий день)</option>
                      <option value="отсутствовала">Отсутствовала</option>
                    </select>
                  </div>
                </div>

                {/* Stimulants */}
                <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-800/80">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={caffeine}
                      onChange={(e) => setCaffeine(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-teal-500 focus:ring-teal-500"
                    />
                    <span>Кофеин (&gt;1-2 чашек)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alcohol}
                      onChange={(e) => setAlcohol(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-teal-500 focus:ring-teal-500"
                    />
                    <span>Алкоголь</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasDiscomfort}
                      onChange={(e) => setHasDiscomfort(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-teal-500 focus:ring-teal-500"
                    />
                    <span>Физический боль / дискомфорт</span>
                  </label>
                </div>

                {hasDiscomfort && (
                  <input
                    type="text"
                    placeholder="Уточните локализацию боли (например, головная боль, спазм ЖКТ)..."
                    value={discomfortDetails}
                    onChange={(e) => setDiscomfortDetails(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                )}
              </div>
            </>
          )}

          {/* Additional note */}
          <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 space-y-2">
            <label className="text-sm font-semibold text-white block">
              Хочешь добавить что-то ещё? (Заметки)
            </label>
            <textarea
              rows={2}
              placeholder="Свободные мысли, заметки на будущее..."
              value={additionalNote}
              onChange={(e) => setAdditionalNote(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 text-xs font-bold transition shadow-lg shadow-teal-500/20 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Сохранить и проанализировать с ИИ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
