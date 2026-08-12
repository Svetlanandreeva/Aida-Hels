import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SubjectProfile, SubjectProfileType } from '../utils/subjectProfiles';
import {
  User,
  Users,
  Baby,
  Plus,
  Check,
  ChevronDown,
  X,
  Trash2,
  ShieldCheck,
  Edit2,
  Lock,
} from 'lucide-react';

interface SubjectProfileSwitcherProps {
  profiles: SubjectProfile[];
  activeSubjectProfileId: string;
  onSelectProfile: (subjectProfileId: string) => void;
  onAddProfile: (newProfile: Omit<SubjectProfile, 'id' | 'accountId'>) => void;
  onDeleteProfile: (subjectProfileId: string) => void;
  accountEmail?: string;
  accountFullName?: string;
}

export const SubjectProfileSwitcher: React.FC<SubjectProfileSwitcherProps> = ({
  profiles,
  activeSubjectProfileId,
  onSelectProfile,
  onAddProfile,
  onDeleteProfile,
  accountEmail,
  accountFullName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State for Adding New Subject Profile
  const [addType, setAddType] = useState<SubjectProfileType>('child');
  const [fullName, setFullName] = useState('');
  const [relationship, setRelationship] = useState('Сын');
  const [birthDate, setBirthDate] = useState('2020-05-15');
  const [gender, setGender] = useState<'female' | 'male'>('male');
  const [height, setHeight] = useState<number>(115);
  const [weight, setWeight] = useState<number>(20);
  const [avatarColor, setAvatarColor] = useState('#34F5A4');

  const activeProfile =
    profiles.find((p) => p.id === activeSubjectProfileId) ||
    profiles[0] || {
      id: 'sp-default',
      fullName: 'Я (Собственный профиль)',
      relationship: 'Я',
      type: 'self' as const,
    };

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    onAddProfile({
      type: addType,
      fullName: fullName.trim(),
      relationship: relationship.trim() || (addType === 'child' ? 'Ребёнок' : 'Родственник'),
      birthDate,
      gender,
      height: Number(height) || (addType === 'child' ? 110 : 170),
      weight: Number(weight) || (addType === 'child' ? 20 : 70),
      avatarColor,
      isPrimary: false,
      permissions: ['view', 'edit'],
    });

    // Reset Form & Close
    setFullName('');
    setIsAddModalOpen(false);
  };

  const getProfileIcon = (type: SubjectProfileType) => {
    switch (type) {
      case 'child':
        return <Baby className="w-4 h-4 text-emerald-400" />;
      case 'relative':
        return <Users className="w-4 h-4 text-sky-400" />;
      default:
        return <User className="w-4 h-4 text-violet-400" />;
    }
  };

  return (
    <div className="relative inline-block text-left">
      {/* TRIGGER BUTTON IN HEADER */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl bg-[#0E1726]/90 border border-[#8968FF]/30 hover:border-[#8968FF]/60 text-white transition-all cursor-pointer shadow-md hover:bg-[#131F33] group"
        title="Сменить субъект медицинских данных"
      >
        <div
          className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-inner"
          style={{ backgroundColor: activeProfile.avatarColor || '#8968FF' }}
        >
          {getProfileIcon(activeProfile.type)}
        </div>

        <div className="flex flex-col text-left max-w-[130px] sm:max-w-[180px] truncate">
          <span className="text-[10px] font-semibold text-white/50 tracking-wider uppercase leading-none">
            Субъект
          </span>
          <span className="text-xs sm:text-sm font-extrabold text-white truncate leading-tight">
            {activeProfile.relationship === 'Я' ? activeProfile.fullName : `${activeProfile.fullName} (${activeProfile.relationship})`}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-white/60 group-hover:text-white transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* DROPDOWN MENU */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop click dismiss */}
            <div
              className="fixed inset-0 z-[110]"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-80 sm:w-96 bg-[#0E1726] border border-white/15 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-4 z-[120] space-y-3"
            >
              {/* Header Info */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <ShieldCheck className="w-4 h-4 text-[#34F5A4]" />
                    <span>Профили субъектов</span>
                  </div>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    Авторизован аккаунт: <strong className="text-white/80">{accountEmail || accountFullName || 'Пользователь'}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-2 bg-[#080D1A] rounded-xl border border-white/[0.06] text-[11px] text-white/60 space-y-1">
                <p className="font-semibold text-white/80 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-[#34F5A4]" /> Изоляция данных:
                </p>
                <p className="text-white/50">
                  Все анализы, дневники, напоминания и ответы ИИ фильтруются строго для выбранного <span className="text-[#34F5A4]">subject_profile_id</span>.
                </p>
              </div>

              {/* Profiles List */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {profiles.map((profile) => {
                  const isActive = profile.id === activeSubjectProfileId;
                  return (
                    <div
                      key={profile.id}
                      onClick={() => {
                        onSelectProfile(profile.id);
                        setIsOpen(false);
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer group ${
                        isActive
                          ? 'bg-[#8968FF]/15 border-[#8968FF] text-white shadow-md'
                          : 'bg-[#121B2D]/60 border-white/[0.06] text-white/70 hover:bg-[#18243B] hover:text-white hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 shadow-inner font-bold text-xs"
                          style={{ backgroundColor: profile.avatarColor || '#8968FF' }}
                        >
                          {getProfileIcon(profile.type)}
                        </div>

                        <div className="flex flex-col text-left">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            {profile.fullName}
                            {profile.isPrimary && (
                              <span className="px-1.5 py-0.2 rounded-md bg-[#8968FF]/30 text-[#C8BAFF] text-[9px] uppercase font-bold">
                                Мой профиль
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-white/50">
                            Роль: {profile.relationship} {profile.birthDate ? `• ${profile.birthDate}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isActive && <Check className="w-4 h-4 text-[#34F5A4]" />}
                        {!profile.isPrimary && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Удалить профиль «${profile.fullName}» и отфильтровать его медицинские данные?`)) {
                                onDeleteProfile(profile.id);
                              }
                            }}
                            className="p-1 text-white/30 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                            title="Удалить профиль субъекта"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Profile Buttons */}
              <div className="pt-2 border-t border-white/10 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddType('child');
                    setRelationship('Сын');
                    setIsAddModalOpen(true);
                  }}
                  className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Baby className="w-3.5 h-3.5" />
                  <span>+ Ребёнок</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAddType('relative');
                    setRelationship('Мама');
                    setIsAddModalOpen(true);
                  }}
                  className="flex-1 py-2 px-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30 hover:bg-sky-500/25 text-sky-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>+ Родственник</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* CREATE SUBJECT PROFILE MODAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0E1726] border border-white/15 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 relative"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#8968FF]/20 border border-[#8968FF]/40 flex items-center justify-center text-[#8968FF]">
                    {addType === 'child' ? <Baby className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">
                      {addType === 'child' ? 'Новый детский профиль' : 'Профиль родственника / взрослого'}
                    </h3>
                    <p className="text-xs text-white/50">
                      Отдельный subject_profile_id для ведения медицинских данных
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 text-white/50 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateProfile} className="space-y-4 text-xs">
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="block text-white/70 font-semibold">ФИО / Имя субъекта</label>
                  <input
                    type="text"
                    required
                    placeholder={addType === 'child' ? 'например, Александр Иваново' : 'например, Елена Васильевна'}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#080D1A] border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#8968FF]"
                  />
                </div>

                {/* Relationship */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-white/70 font-semibold">Роль / Родство</label>
                    <select
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#080D1A] border border-white/15 rounded-xl text-white focus:outline-none focus:border-[#8968FF]"
                    >
                      {addType === 'child' ? (
                        <>
                          <option value="Сын">Сын</option>
                          <option value="Дочь">Дочь</option>
                          <option value="Подопечный">Подопечный</option>
                          <option value="Ребёнок">Ребёнок</option>
                        </>
                      ) : (
                        <>
                          <option value="Мама">Мама</option>
                          <option value="Отец">Отец</option>
                          <option value="Бабушка">Бабушка</option>
                          <option value="Дедушка">Дедушка</option>
                          <option value="Супруг/а">Супруг/а</option>
                          <option value="Брат/Сестра">Брат/Сестра</option>
                          <option value="Родственник">Родственник</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-white/70 font-semibold">Пол</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as 'female' | 'male')}
                      className="w-full px-3 py-2.5 bg-[#080D1A] border border-white/15 rounded-xl text-white focus:outline-none focus:border-[#8968FF]"
                    >
                      <option value="male">Мужской</option>
                      <option value="female">Женский</option>
                    </select>
                  </div>
                </div>

                {/* Birth Date */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1 col-span-1">
                    <label className="block text-white/70 font-semibold">Дата рождения</label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full px-2.5 py-2.5 bg-[#080D1A] border border-white/15 rounded-xl text-white focus:outline-none focus:border-[#8968FF]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-white/70 font-semibold">Рост (см)</label>
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                      className="w-full px-3 py-2.5 bg-[#080D1A] border border-white/15 rounded-xl text-white focus:outline-none focus:border-[#8968FF]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-white/70 font-semibold">Вес (кг)</label>
                    <input
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(Number(e.target.value))}
                      className="w-full px-3 py-2.5 bg-[#080D1A] border border-white/15 rounded-xl text-white focus:outline-none focus:border-[#8968FF]"
                    />
                  </div>
                </div>

                {/* Color Selector */}
                <div className="space-y-1.5">
                  <label className="block text-white/70 font-semibold">Цветовой маркер профиля</label>
                  <div className="flex items-center gap-2">
                    {['#34F5A4', '#38BDF8', '#8968FF', '#F59E0B', '#EC4899', '#10B981'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAvatarColor(c)}
                        className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                          avatarColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 font-bold text-xs transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#8968FF] hover:bg-[#7854f7] text-white font-bold text-xs transition-all shadow-lg hover:shadow-[#8968FF]/30 cursor-pointer"
                  >
                    Создать профиль
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
