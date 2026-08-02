import React, { useState } from 'react';
import { UserProfile, ScreenId } from '../types';
import {
  User,
  Calendar,
  Ruler,
  Weight,
  Heart,
  ShieldCheck,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Brain,
  Sparkles,
  Lock,
  Mail,
  Eye,
  EyeOff,
} from 'lucide-react';

interface QuestionnaireProps {
  currentStep: 'q1' | 'q2' | 'q3' | 'q4' | 'q5';
  setCurrentStep: (step: 'q1' | 'q2' | 'q3' | 'q4' | 'q5') => void;
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  onComplete: () => void;
}

export const Questionnaire: React.FC<QuestionnaireProps> = ({
  currentStep,
  setCurrentStep,
  user,
  setUser,
  onComplete,
}) => {
  // Local state initialized with user profile
  const [newAllergy, setNewAllergy] = useState('');
  const [newDiagnosisName, setNewDiagnosisName] = useState('');
  const [newMedication, setNewMedication] = useState('');
  const [newDiagnosisYear, setNewDiagnosisYear] = useState('2024');

  // Login credentials local states
  const [loginEmail, setLoginEmail] = useState(user.email || '');
  const [loginPassword, setLoginPassword] = useState(user.password || '');
  const [confirmPassword, setConfirmPassword] = useState(user.password || '');
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Psychiatric local states
  const [newPsychDiagnosis, setNewPsychDiagnosis] = useState('');
  const [newPsychSymptom, setNewPsychSymptom] = useState('');
  const [newPsychMed, setNewPsychMed] = useState('');

  // Step 1 handler
  const handleNextFrom1 = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep('q2');
  };

  // Step 2 handler
  const handleNextFrom2 = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep('q3');
  };

  // Step 3 handler
  const handleNextFrom3 = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep('q4');
  };

  // Step 4 Submit
  const handleConfirmAll = () => {
    if (!loginEmail || !loginEmail.includes('@')) {
      setAuthError('Пожалуйста, укажите корректный адрес электронной почты (email)');
      return;
    }
    if (!loginPassword || loginPassword.length < 6) {
      setAuthError('Пароль должен содержать не менее 6 символов');
      return;
    }
    if (loginPassword !== confirmPassword) {
      setAuthError('Пароли не совпадают. Пожалуйста, проверьте введённый пароль');
      return;
    }
    if (!user.consentsAccepted) {
      setAuthError('Пожалуйста, подтвердите согласие на обработку персональных данных');
      return;
    }

    setAuthError(null);

    // Persist registered credentials to localStorage for AuthScreen login
    localStorage.setItem(
      'app_saved_credentials',
      JSON.stringify({
        email: loginEmail.trim(),
        password: loginPassword,
        fullName: user.fullName,
      })
    );

    const newSnapshot = {
      survey_id: `survey-${Date.now()}`,
      user_id: user.id || 'usr-1',
      survey_version: 'v1.2',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      completion_percent: 100,
      answers: {
        bloodType: user.bloodType,
        rhFactor: user.rhFactor,
        allergies: user.allergies,
        diagnosesCount: user.chronicDiagnoses.length,
        stressLevel: user.psychology.stressLevel,
        sleepHours: user.psychology.sleepHours,
      },
      skipped_questions: [],
      ai_summary: 'Сформирована предварительная картина на основании вашего опроса. Показатели сохранены.',
      attention_areas: user.allergies.length > 0 ? ['Аллергический профиль'] : [],
      confidence: 0.85,
      created_at: new Date().toISOString(),
    };

    setUser((prev) => ({
      ...prev,
      email: loginEmail.trim(),
      password: loginPassword,
      isAuthenticated: true,
      isQuestionnaireCompleted: true,
      introCardDismissedAt: new Date().toISOString(),
      questionnaireHistory: [newSnapshot, ...(prev.questionnaireHistory || [])],
    }));
    setCurrentStep('q5');
  };

  // Allergy helper
  const addAllergy = () => {
    if (newAllergy.trim()) {
      setUser((prev) => ({
        ...prev,
        allergies: [...prev.allergies, newAllergy.trim()],
      }));
      setNewAllergy('');
    }
  };

  const removeAllergy = (index: number) => {
    setUser((prev) => ({
      ...prev,
      allergies: prev.allergies.filter((_, i) => i !== index),
    }));
  };

  // Diagnosis helper
  const addDiagnosis = () => {
    if (newDiagnosisName.trim()) {
      setUser((prev) => ({
        ...prev,
        chronicDiagnoses: [
          ...prev.chronicDiagnoses,
          {
            id: Date.now().toString(),
            name: newDiagnosisName.trim(),
            medication: newMedication.trim() || 'Без медикаментов',
            sinceYear: newDiagnosisYear,
          },
        ],
      }));
      setNewDiagnosisName('');
      setNewMedication('');
    }
  };

  const removeDiagnosis = (id: string) => {
    setUser((prev) => ({
      ...prev,
      chronicDiagnoses: prev.chronicDiagnoses.filter((d) => d.id !== id),
    }));
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      {/* Step Progress Bar */}
      {currentStep !== 'q5' && (
        <div className="bg-[#14171C] p-4 rounded-2xl border border-gray-800 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-gray-400">
            <div className="flex items-center gap-2">
              <span>Заполнение анкеты анамнеза (добровольно)</span>
              <span className="text-gray-500 font-normal">|</span>
              <button
                type="button"
                onClick={onComplete}
                className="text-gray-400 hover:text-gray-200 hover:underline font-normal cursor-pointer"
              >
                Сохранить черновик и выйти
              </button>
            </div>
            <span className="text-emerald-400">
              {currentStep === 'q1' && 'Шаг 1 из 3: Знакомство'}
              {currentStep === 'q2' && 'Шаг 2 из 3: Медицинская карта'}
              {currentStep === 'q3' && 'Шаг 3 из 3: Психология'}
              {currentStep === 'q4' && 'Шаг 4: Проверка данных'}
            </span>
          </div>
          <div className="w-full bg-gray-900 h-2 rounded-full overflow-hidden flex border border-gray-800">
            <div
              className={`h-full bg-emerald-500 transition-all duration-300 ${
                currentStep === 'q1'
                  ? 'w-1/4'
                  : currentStep === 'q2'
                  ? 'w-2/4'
                  : currentStep === 'q3'
                  ? 'w-3/4'
                  : 'w-full'
              }`}
            />
          </div>
        </div>
      )}

      {/* STEP 1: Знакомство */}
      {currentStep === 'q1' && (
        <form onSubmit={handleNextFrom1} className="bg-[#14171C] rounded-2xl border border-gray-800 shadow-xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-gray-800 pb-4">
            <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-400" />
              <span>1. Знакомство и антропометрия</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Укажите персональные данные для корректного расчета медицинских референсов и ИМТ.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                ФИО полностью
              </label>
              <input
                type="text"
                required
                value={user.fullName}
                onChange={(e) => setUser({ ...user, fullName: e.target.value })}
                placeholder="Иванова Анна Сергеевна"
                className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Дата рождения
                </label>
                <input
                  type="date"
                  required
                  value={user.birthDate}
                  onChange={(e) => setUser({ ...user, birthDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Пол</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUser({ ...user, gender: 'female' })}
                    className={`py-2.5 text-xs font-semibold rounded-xl border transition-all ${
                      user.gender === 'female'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                        : 'bg-gray-900 border-gray-700 text-gray-400'
                    }`}
                  >
                    Женский
                  </button>
                  <button
                    type="button"
                    onClick={() => setUser({ ...user, gender: 'male' })}
                    className={`py-2.5 text-xs font-semibold rounded-xl border transition-all ${
                      user.gender === 'male'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                        : 'bg-gray-900 border-gray-700 text-gray-400'
                    }`}
                  >
                    Мужской
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Рост (см)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="100"
                    max="230"
                    required
                    value={user.height}
                    onChange={(e) => setUser({ ...user, height: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-3 text-xs text-gray-500">см</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Вес (кг)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="30"
                    max="200"
                    required
                    value={user.weight}
                    onChange={(e) => setUser({ ...user, weight: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-3 text-xs text-gray-500">кг</span>
                </div>
              </div>
            </div>

            {/* Calculated BMI Badge */}
            <div className="bg-[#0F1115] p-3.5 rounded-xl border border-gray-800 flex items-center justify-between text-xs">
              <span className="text-gray-400 font-medium">Расчетный Индекс Массы Тела (ИМТ):</span>
              <span className="font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                {(user.weight / Math.pow(user.height / 100, 2)).toFixed(1)} кг/м²
              </span>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Далее: Медицинская карта</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 2: Медицинская карта */}
      {currentStep === 'q2' && (
        <form onSubmit={handleNextFrom2} className="bg-[#14171C] rounded-2xl border border-gray-800 shadow-xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-gray-800 pb-4">
            <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
              <Heart className="w-5 h-5 text-emerald-400" />
              <span>2. Медицинская карта и диагнозы</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Информация о вашей группе крови, аллергиях и хронических заболеваниях.
            </p>
          </div>

          <div className="space-y-5">
            {/* Blood Type & Rh Factor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Группа крови
                </label>
                <select
                  value={user.bloodType}
                  onChange={(e) => setUser({ ...user, bloodType: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="I (O)">I (O)</option>
                  <option value="II (A)">II (A)</option>
                  <option value="III (B)">III (B)</option>
                  <option value="IV (AB)">IV (AB)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Резус-фактор
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUser({ ...user, rhFactor: '+' })}
                    className={`py-2.5 text-xs font-semibold rounded-xl border transition-all ${
                      user.rhFactor === '+'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                        : 'bg-gray-900 border-gray-700 text-gray-400'
                    }`}
                  >
                    Положительный (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUser({ ...user, rhFactor: '-' })}
                    className={`py-2.5 text-xs font-semibold rounded-xl border transition-all ${
                      user.rhFactor === '-'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                        : 'bg-gray-900 border-gray-700 text-gray-400'
                    }`}
                  >
                    Отрицательный (-)
                  </button>
                </div>
              </div>
            </div>

            {/* Allergies List */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Аллергические реакции (препараты, продукты, пыльца)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newAllergy}
                  onChange={(e) => setNewAllergy(e.target.value)}
                  placeholder="Например: Ампициллин"
                  className="flex-1 px-3.5 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={addAllergy}
                  className="px-3 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-emerald-400 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {user.allergies.map((allergy, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-xs font-medium"
                  >
                    <span>{allergy}</span>
                    <button
                      type="button"
                      onClick={() => removeAllergy(idx)}
                      className="text-rose-400 hover:text-rose-200"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Chronic Diagnoses & Medications */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-300">
                Хронические диагнозы и регулярно принимаемые препараты
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#0F1115] p-3 rounded-xl border border-gray-800">
                <input
                  type="text"
                  value={newDiagnosisName}
                  onChange={(e) => setNewDiagnosisName(e.target.value)}
                  placeholder="Диагноз (напр. Гипотиреоз)"
                  className="px-3 py-2 bg-gray-900 border border-gray-700 text-gray-100 rounded-lg text-xs placeholder-gray-500"
                />
                <input
                  type="text"
                  value={newMedication}
                  onChange={(e) => setNewMedication(e.target.value)}
                  placeholder="Препарат и доза (напр. Эутирокс 50)"
                  className="px-3 py-2 bg-gray-900 border border-gray-700 text-gray-100 rounded-lg text-xs placeholder-gray-500"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDiagnosisYear}
                    onChange={(e) => setNewDiagnosisYear(e.target.value)}
                    placeholder="Год установления"
                    className="w-24 px-2 py-2 bg-gray-900 border border-gray-700 text-gray-100 rounded-lg text-xs placeholder-gray-500"
                  />
                  <button
                    type="button"
                    onClick={addDiagnosis}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Добавить</span>
                  </button>
                </div>
              </div>

              {/* Diagnosis List */}
              <div className="space-y-2 pt-2">
                {user.chronicDiagnoses.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between p-3 bg-[#0F1115] border border-gray-800 rounded-xl text-xs"
                  >
                    <div>
                      <span className="font-bold text-gray-100">{d.name}</span>
                      <span className="text-gray-400 ml-2">({d.sinceYear} г.)</span>
                      <p className="text-emerald-400 mt-0.5">Препарат: {d.medication}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDiagnosis(d.id)}
                      className="text-gray-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* ORVI Frequency */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Частота ОРВИ и простудных заболеваний
              </label>
              <select
                value={user.orviFrequency}
                onChange={(e) => setUser({ ...user, orviFrequency: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="Редко (менее 1 раза в год)">Редко (менее 1 раза в год)</option>
                <option value="1-2 раза в год">1-2 раза в год</option>
                <option value="Часто (3-4 раза в год)">Часто (3-4 раза в год)</option>
                <option value="Очень часто (более 5 раз в год)">Очень часто (более 5 раз в год)</option>
              </select>
            </div>

            {/* WOMEN HEALTH BLOCK (Conditional) */}
            {user.gender === 'female' && user.womenHealth && (
              <div className="bg-pink-950/20 border border-pink-500/20 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-pink-300 font-bold text-sm border-b border-pink-500/20 pb-2">
                  <Sparkles className="w-4 h-4 text-pink-400" />
                  <span>Блок женского здоровья (Цикл и самочувствие)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-pink-200 mb-1">
                      Длительность цикла (дней)
                    </label>
                    <input
                      type="number"
                      min="20"
                      max="45"
                      value={user.womenHealth.cycleLength}
                      onChange={(e) =>
                        setUser({
                          ...user,
                          womenHealth: {
                            ...user.womenHealth!,
                            cycleLength: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full px-3.5 py-2 bg-gray-900 border border-pink-500/30 text-gray-100 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-pink-200 mb-1">
                      Дата последней менструации
                    </label>
                    <input
                      type="date"
                      value={user.womenHealth.lastPeriodDate}
                      onChange={(e) =>
                        setUser({
                          ...user,
                          womenHealth: {
                            ...user.womenHealth!,
                            lastPeriodDate: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3.5 py-2 bg-gray-900 border border-pink-500/30 text-gray-100 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-pink-200 mb-1">
                    Уровень болезненности (1 - без боли, 10 - выраженная боль)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={user.womenHealth.painLevel}
                      onChange={(e) =>
                        setUser({
                          ...user,
                          womenHealth: {
                            ...user.womenHealth!,
                            painLevel: Number(e.target.value),
                          },
                        })
                      }
                      className="flex-1 accent-pink-500"
                    />
                    <span className="font-bold text-pink-300 text-xs px-2 py-1 bg-pink-500/20 border border-pink-500/30 rounded-md">
                      {user.womenHealth.painLevel} / 10
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep('q1')}
              className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-gray-200 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Назад</span>
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Далее: Психология и сон</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 3: Психология */}
      {currentStep === 'q3' && (
        <form onSubmit={handleNextFrom3} className="bg-[#14171C] rounded-2xl border border-gray-800 shadow-xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-gray-800 pb-4">
            <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
              <Brain className="w-5 h-5 text-emerald-400" />
              <span>3. Психология, сон и нервная система</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Оценка психоэмоционального фона, факторов стресса и гигиены сна.
            </p>
          </div>

          <div className="space-y-6">
            {/* Stress Level */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-gray-300">
                  Субъективный уровень стресса за последний месяц
                </label>
                <span className="font-bold text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  {user.psychology.stressLevel} из 10
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={user.psychology.stressLevel}
                onChange={(e) =>
                  setUser({
                    ...user,
                    psychology: {
                      ...user.psychology,
                      stressLevel: Number(e.target.value),
                    },
                  })
                }
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>1 - Абсолютно спокоен</span>
                <span>5 - Умеренный стресс</span>
                <span>10 - Высокий выгорательный стресс</span>
              </div>
            </div>

            {/* Sleep Hours */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Средняя продолжительность ночного сна (часов)
              </label>
              <input
                type="number"
                step="0.5"
                min="3"
                max="14"
                value={user.psychology.sleepHours}
                onChange={(e) =>
                  setUser({
                    ...user,
                    psychology: {
                      ...user.psychology,
                      sleepHours: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Mood selector */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-2">
                Преобладающее настроение
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'excellent', label: 'Отличное / Энергичное' },
                  { id: 'good', label: 'Хорошее / Стабильное' },
                  { id: 'neutral', label: 'Нейтральное / Ровное' },
                  { id: 'anxious', label: 'Тревожное / Беспокойное' },
                  { id: 'depressed', label: 'Апатичное / Подавленное' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setUser({
                        ...user,
                        psychology: {
                          ...user.psychology,
                          mood: item.id as any,
                        },
                      })
                    }
                    className={`p-2.5 text-xs font-semibold rounded-xl border text-left transition-all cursor-pointer ${
                      user.psychology.mood === item.id
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* OPTIONAL PSYCHIATRIC BLOCK */}
            <div className="bg-[#0F1115] p-5 rounded-2xl border border-gray-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-bold text-gray-200">
                    Опционально: Психиатрический анамнез
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={user.psychology.hasPsychiatricHistory}
                    onChange={(e) =>
                      setUser({
                        ...user,
                        psychology: {
                          ...user.psychology,
                          hasPsychiatricHistory: e.target.checked,
                          psychiatricData: e.target.checked
                            ? user.psychology.psychiatricData || {
                                diagnoses: ['Тревожно-депрессивное расстройство'],
                                symptoms: ['Бессонница'],
                                medications: ['Сертралин 50 мг'],
                                specialistInfo: 'Д-р Васильев Н. А.',
                              }
                            : undefined,
                        },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-600 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {user.psychology.hasPsychiatricHistory && (
                <div className="space-y-3 pt-2 text-xs border-t border-gray-800">
                  <p className="text-[11px] text-gray-400">
                    Эти данные будут видны только вам и врачу в печатном отчете.
                  </p>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-300 mb-1">
                      Установленные диагнозы / Наблюдение
                    </label>
                    <input
                      type="text"
                      placeholder="Например: ГТР, Депрессивный эпизод"
                      value={user.psychology.psychiatricData?.diagnoses.join(', ') || ''}
                      onChange={(e) =>
                        setUser({
                          ...user,
                          psychology: {
                            ...user.psychology,
                            psychiatricData: {
                              ...user.psychology.psychiatricData!,
                              diagnoses: e.target.value.split(',').map((s) => s.trim()),
                            },
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-gray-100 rounded-lg placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-300 mb-1">
                      Принимаемые фармакопрепараты
                    </label>
                    <input
                      type="text"
                      placeholder="Например: Антидепрессанты / Анксиолитики"
                      value={user.psychology.psychiatricData?.medications.join(', ') || ''}
                      onChange={(e) =>
                        setUser({
                          ...user,
                          psychology: {
                            ...user.psychology,
                            psychiatricData: {
                              ...user.psychology.psychiatricData!,
                              medications: e.target.value.split(',').map((s) => s.trim()),
                            },
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-gray-100 rounded-lg placeholder-gray-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep('q2')}
              className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-gray-200 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Назад</span>
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Далее: Проверка анкеты</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 4: Проверка анкеты */}
      {currentStep === 'q4' && (
        <div className="bg-[#14171C] rounded-2xl border border-gray-800 shadow-xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-gray-800 pb-4">
            <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>4. Проверка и подтверждение анкеты</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Проверьте корректность введённых данных перед сохранением в вашем Личном кабинете.
            </p>
          </div>

          {/* Summary Sections */}
          <div className="space-y-4">
            {/* Sec 1 */}
            <div className="bg-[#0F1115] p-4 rounded-xl border border-gray-800 space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-gray-800 pb-1.5">
                <span className="font-bold text-gray-200">1. Личные данные</span>
                <button
                  onClick={() => setCurrentStep('q1')}
                  className="text-emerald-400 hover:underline font-semibold cursor-pointer"
                >
                  Изменить
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-gray-400">
                <div>ФИО: <strong className="text-gray-200">{user.fullName}</strong></div>
                <div>Дата рождения: <strong className="text-gray-200">{user.birthDate}</strong></div>
                <div>Рост/Вес: <strong className="text-gray-200">{user.height} см / {user.weight} кг</strong></div>
                <div>Пол: <strong className="text-gray-200">{user.gender === 'female' ? 'Женский' : 'Мужской'}</strong></div>
              </div>
            </div>

            {/* Sec 2 */}
            <div className="bg-[#0F1115] p-4 rounded-xl border border-gray-800 space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-gray-800 pb-1.5">
                <span className="font-bold text-gray-200">2. Медицинская карта</span>
                <button
                  onClick={() => setCurrentStep('q2')}
                  className="text-emerald-400 hover:underline font-semibold cursor-pointer"
                >
                  Изменить
                </button>
              </div>
              <div className="space-y-1 text-gray-400">
                <div>Группа крови: <strong className="text-gray-200">{user.bloodType} ({user.rhFactor})</strong></div>
                <div>
                  Аллергии:{' '}
                  {user.allergies.length > 0 ? (
                    <span className="text-rose-400 font-semibold">{user.allergies.join(', ')}</span>
                  ) : (
                    <span className="text-gray-500">Отсутствуют</span>
                  )}
                </div>
                <div>
                  Диагнозы:{' '}
                  {user.chronicDiagnoses.length > 0 ? (
                    <span className="text-gray-200">{user.chronicDiagnoses.map((d) => `${d.name} (${d.medication})`).join('; ')}</span>
                  ) : (
                    <span className="text-gray-500">Нет данных</span>
                  )}
                </div>
              </div>
            </div>

            {/* Sec 3 */}
            <div className="bg-[#0F1115] p-4 rounded-xl border border-gray-800 space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-gray-800 pb-1.5">
                <span className="font-bold text-gray-200">3. Психология и сон</span>
                <button
                  onClick={() => setCurrentStep('q3')}
                  className="text-emerald-400 hover:underline font-semibold cursor-pointer"
                >
                  Изменить
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-gray-400">
                <div>Уровень стресса: <strong className="text-gray-200">{user.psychology.stressLevel} / 10</strong></div>
                <div>Сон: <strong className="text-gray-200">{user.psychology.sleepHours} ч/сутки</strong></div>
              </div>
            </div>

            {/* Sec 4: Account Credentials (Login & Password) */}
            <div className="bg-[#0F1115] p-5 rounded-2xl border border-emerald-500/30 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-gray-800 pb-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-100">4. Создание аккаунта (Логин и Пароль)</h3>
                  <p className="text-[11px] text-gray-400">Укажите адрес электронной почты и пароль для авторизации</p>
                </div>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Email / Логин <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      placeholder="anna.ivanova@health.ru"
                      className="w-full pl-9 pr-3 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Придумайте пароль <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      placeholder="Минимум 6 символов"
                      className="w-full pl-9 pr-10 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Повторите пароль <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      placeholder="Повторите введённый пароль"
                      className="w-full pl-9 pr-3 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Consents Checkbox */}
            <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={user.consentsAccepted}
                  onChange={(e) => setUser({ ...user, consentsAccepted: e.target.checked })}
                  className="mt-0.5 rounded border-gray-700 bg-gray-900 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-xs text-gray-300 leading-snug">
                  Я даю согласие на обработку моих персональных и медицинских данных в соответствии с ФЗ-152 и подтверждаю ознакомление с политикой конфиденциальности.
                </span>
              </label>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep('q3')}
              className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-gray-200 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Назад</span>
            </button>
            <button
              type="button"
              onClick={handleConfirmAll}
              className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Сохранить и запустить профиль</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Успех */}
      {currentStep === 'q5' && (
        <div className="bg-[#14171C] rounded-3xl border border-gray-800 shadow-xl p-8 sm:p-12 text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto shadow-inner animate-bounce">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-100">
              Анкета успешно сохранена!
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              Ваш цифровой медпрофиль сформирован. На его основе автоматически построена карта 10 систем организма и подготовлен ИИ-ассистент.
            </p>
          </div>

          <div className="pt-4">
            <button
              onClick={onComplete}
              className="px-8 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-2xl shadow-lg shadow-emerald-500/20 transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Перейти в Личный Кабинет</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
