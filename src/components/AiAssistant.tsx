import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Heart, RefreshCw, Stethoscope, Moon, Apple, Copy, Check, Bot, Cpu, CheckCircle2, XCircle, Lock, ShieldAlert } from 'lucide-react';
import { UserProfile, MedicalDocument, DailyLogEntry, DiaryEntry, Reminder } from '../types';
import { AiToolsGovernanceModal } from './AiToolsGovernanceModal';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  botRoleId?: string;
  botName?: string;
  stagedCandidate?: any;
}

interface AiAssistantProps {
  user: UserProfile;
  documents?: MedicalDocument[];
  dailyLogs?: DailyLogEntry[];
  diaryEntries?: DiaryEntry[];
  reminders?: Reminder[];
  pressureLogs?: any[];
}

export interface BotRole {
  id: string;
  name: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  badgeColor: string;
  avatarBg: string;
  quickPrompts: string[];
  greeting: string;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({
  user,
  documents = [],
  dailyLogs = [],
  diaryEntries = [],
  reminders = [],
  pressureLogs = [],
}) => {
  const botRoles: BotRole[] = [
    {
      id: 'aida',
      name: 'Аида',
      title: 'Персональный ИИ-курирующий врач',
      description: 'Анализ общего состояния, дневников и динамики здоровья',
      icon: <Heart className="w-4 h-4 text-emerald-400" />,
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      avatarBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      greeting: `Привет! Я Аида — твой главный помощник. Я регулярно смотрю за твоим состоянием, данными сна, дневниками и давлением. О чём ты хочешь поговорить? 🤍`,
      quickPrompts: [
        'Как моё ментальное состояние?',
        'Что с моим давлением и пульсом?',
        'Оцени мой уровень стресса и сна',
        'Что делать при усталости к вечеру?',
      ],
    },
    {
      id: 'sofia',
      name: 'Доктор София',
      title: 'Эксперт по анализам и УЗИ',
      description: 'Расшифровка лаборатории, бланков крови и заключений',
      icon: <Stethoscope className="w-4 h-4 text-cyan-400" />,
      badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      avatarBg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      greeting: `Здравствуйте! Я Доктор София. Помогу разобрать лабораторные бланки, анализы крови, гормонов и узи-обследования простым языком. Какую лабораторную цифру проанализировать? 🔬`,
      quickPrompts: [
        'Что делать при снижении Витамина D?',
        'Как расшифровать высокий ферритин?',
        'Что значат изменения в общем анализе крови?',
        'Проверь мои загруженные медицинские документы',
      ],
    },
    {
      id: 'mark',
      name: 'Марк',
      title: 'Консультант по сну и нервной системе',
      description: 'Восстановление энергии, борьба с тревожностью и гигиена сна',
      icon: <Moon className="w-4 h-4 text-indigo-400" />,
      badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      avatarBg: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      greeting: `Привет! Я Марк. Занимаюсь гигиеной сна, снижением тревоги и физиологией глубокого отдыха. Как ты чувствуешь себя сегодня после пробуждения? 🌙`,
      quickPrompts: [
        'Как улучшить качество фазы глубокого сна?',
        'Что делать при вечерней тревожности?',
        'Дай технику дыхания для быстрого засыпания',
        'Почему я просыпаюсь уставшим?',
      ],
    },
    {
      id: 'eva',
      name: 'Ева',
      title: 'Нутрициолог и эксперт метаболизма',
      description: 'Сбалансированный рацион, микроэлементы и здоровые привычки',
      icon: <Apple className="w-4 h-4 text-amber-400" />,
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      avatarBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      greeting: `Привет! Я Ева. Отвечаю за питание, гармонию метаболизма и подбор микроэлементов. Настроим твой рацион на легкую энергию и отличный обмен веществ! 🥗`,
      quickPrompts: [
        'Сбалансируй мой ежедневный рацион',
        'Какие продукты помогут при упадке сил?',
        'Как совмещать приём витаминов и магния?',
        'Как уменьшить тягу к сладкому после обеда?',
      ],
    },
  ];

  const STORAGE_KEY_MESSAGES = 'aida_chat_messages_v1';
  const STORAGE_KEY_BOT_ID = 'aida_active_bot_id';

  const [activeBotId, setActiveBotId] = useState<string>(() => {
    try {
      const savedBot = localStorage.getItem(STORAGE_KEY_BOT_ID);
      if (savedBot && botRoles.some((b) => b.id === savedBot)) {
        return savedBot;
      }
    } catch {
      // ignore
    }
    return 'aida';
  });

  const activeBot = botRoles.find((b) => b.id === activeBotId) || botRoles[0];

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const savedMsgs = localStorage.getItem(STORAGE_KEY_MESSAGES);
      if (savedMsgs) {
        const parsed = JSON.parse(savedMsgs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [
      {
        id: '1',
        sender: 'ai',
        text: botRoles[0].greeting,
        timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        botRoleId: botRoles[0].id,
        botName: botRoles[0].name,
      },
    ];
  });

  // Save messages to localStorage on change
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
      }
    } catch {
      // ignore
    }
  }, [messages]);

  const [isGovernanceOpen, setIsGovernanceOpen] = useState(false);

  const handleConfirmCandidateInChat = async (candidateId: string, confirmationToken: string, msgId: string) => {
    try {
      const res = await fetch('/api/ai/candidates/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, confirmationToken }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  stagedCandidate: { ...m.stagedCandidate, status: 'CONFIRMED' },
                  text: `${m.text}\n\n✅ [ПОДТВЕРЖДЕНО ЧЕЛОВЕКОМ]: Данные успешно записаны в вашу медкарту.`,
                }
              : m
          )
        );
      } else {
        alert('Ошибка подтверждения: ' + data.message);
      }
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    }
  };

  const handleRejectCandidateInChat = async (candidateId: string, confirmationToken: string, msgId: string) => {
    try {
      const res = await fetch('/api/ai/candidates/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, confirmationToken, reason: 'Отклонено в чате' }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  stagedCandidate: { ...m.stagedCandidate, status: 'REJECTED' },
                  text: `${m.text}\n\n❌ [ОТКЛОНЕНО ЧЕЛОВЕКОМ]: Запись сброшена и не попала в базу данных.`,
                }
              : m
          )
        );
      } else {
        alert('Ошибка: ' + data.message);
      }
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    }
  };

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleBotChange = (botId: string) => {
    setActiveBotId(botId);
    const targetBot = botRoles.find((b) => b.id === botId) || botRoles[0];
    
    // Check if greeting already present for this bot in recent history
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.botRoleId !== botId) {
      const greetingMsg: Message = {
        id: Date.now().toString(),
        sender: 'ai',
        text: targetBot.greeting,
        timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        botRoleId: targetBot.id,
        botName: targetBot.name,
      };
      setMessages((prev) => [...prev, greetingMsg]);
    }
  };

  const handleClearChat = () => {
    const freshGreeting: Message = {
      id: Date.now().toString(),
      sender: 'ai',
      text: activeBot.greeting,
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      botRoleId: activeBot.id,
      botName: activeBot.name,
    };
    setMessages([freshGreeting]);
    try {
      localStorage.removeItem(STORAGE_KEY_MESSAGES);
    } catch {
      // ignore
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (textToSend?: string) => {
    const promptText = textToSend || input;
    if (!promptText.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    if (!textToSend) setInput('');
    setIsLoading(true);

    // Format multi-turn conversation history for API (last 12 turns)
    const historyPayload = updatedMessages.slice(-12).map((m) => ({
      sender: m.sender,
      role: m.sender === 'user' ? 'user' : 'model',
      text: m.text,
      botName: m.botName,
    }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptText,
          botRoleId: activeBot.id,
          history: historyPayload,
          context: {
            user,
            documents,
            dailyLogs,
            diaryEntries,
            reminders,
            pressureLogs,
          },
        }),
      });

      const data = await response.json();
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: data.text || 'Я рядом. Чем могу тебе помочь по здоровью или самочувствию? 🤍',
        timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        botRoleId: activeBot.id,
        botName: data.botName || activeBot.name,
        stagedCandidate: data.stagedCandidate,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('Chat send error:', err);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: 'Я рядом и сохранила твоё сообщение. Напиши ещё раз или выбери одну из подсказок ниже 🤍',
        timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        botRoleId: activeBot.id,
        botName: activeBot.name,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[82vh] bg-[#14171C] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-[#0F1115] p-4 sm:p-5 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-md ${activeBot.avatarBg}`}>
            {activeBot.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base text-gray-100 flex items-center gap-2">
                <span>{activeBot.name}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </h2>
              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${activeBot.badgeColor}`}>
                {activeBot.title}
              </span>
            </div>
            <p className="text-[12px] text-gray-400 mt-0.5">{activeBot.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setIsGovernanceOpen(true)}
            className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-xl transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            title="Центр контроля инструментов ИИ и токенов безопасности"
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Инструменты ИИ (Rule 15)</span>
          </button>

          <button
            onClick={handleClearChat}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800/80 rounded-xl transition-colors text-xs flex items-center gap-1.5 cursor-pointer border border-gray-800"
            title="Очистить историю диалога"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Очистить чат</span>
          </button>
        </div>
      </div>

      {/* Bot Persona Selector Tabs */}
      <div className="bg-[#0D0F13] px-3 py-2.5 border-b border-gray-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-[11px] font-medium text-gray-500 shrink-0 flex items-center gap-1 pl-1 pr-2">
          <Bot className="w-3.5 h-3.5" /> ИИ-Боты:
        </span>
        {botRoles.map((bot) => {
          const isActive = bot.id === activeBotId;
          return (
            <button
              key={bot.id}
              onClick={() => handleBotChange(bot.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-all shrink-0 cursor-pointer border ${
                isActive
                  ? 'bg-gray-800 text-gray-100 border-gray-700 shadow-sm'
                  : 'bg-transparent text-gray-400 border-transparent hover:bg-gray-800/50 hover:text-gray-200'
              }`}
            >
              <div className="shrink-0">{bot.icon}</div>
              <span>{bot.name}</span>
            </button>
          );
        })}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#0A0B0D]">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const msgBot = botRoles.find((b) => b.id === msg.botRoleId) || activeBot;

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 max-w-[88%] sm:max-w-[80%] ${
                isUser ? 'ml-auto flex-row-reverse' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold shadow-sm ${
                  isUser
                    ? 'bg-emerald-500 text-slate-950'
                    : msgBot.avatarBg
                }`}
              >
                {isUser ? user.fullName.charAt(0) : msgBot.icon}
              </div>

              <div
                className={`group relative p-4 rounded-2xl text-xs sm:text-sm leading-relaxed space-y-1 shadow-xs border ${
                  isUser
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400/30 font-medium rounded-tr-none'
                    : 'bg-[#14171C] text-gray-200 border-gray-800 rounded-tl-none whitespace-pre-line'
                }`}
              >
                {!isUser && msg.botName && (
                  <div className="flex items-center justify-between gap-2 mb-1 pb-1 border-b border-gray-800/60">
                    <span className="text-[11px] font-semibold text-gray-400 flex items-center gap-1.5">
                      {msg.botName}
                    </span>
                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-gray-200 rounded"
                      title="Копировать ответ"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
                <p>{msg.text}</p>

                {/* STAGED CANDIDATE CONFIRMATION CARD (RULE 15 & 16 ENFORCEMENT) */}
                {msg.stagedCandidate && (
                  <div className="mt-3 p-3.5 bg-[#0B1320] border border-amber-500/30 rounded-xl space-y-2.5 font-sans shadow-lg">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Карантин CandidateRecord (Rule 16)</span>
                      </div>
                      <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-black border border-amber-500/30">
                        {msg.stagedCandidate.confirmationToken || 'TOKEN_PENDING'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap text-[11px]">
                        {msg.stagedCandidate.payload?.factCategory && (
                          <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded font-semibold uppercase text-[9px] tracking-wider">
                            {msg.stagedCandidate.payload.factCategory === 'measurement'
                              ? 'Замер / Vitals'
                              : msg.stagedCandidate.payload.factCategory === 'symptom'
                              ? 'Симптом'
                              : msg.stagedCandidate.payload.factCategory === 'medication'
                              ? 'Лекарство'
                              : msg.stagedCandidate.payload.factCategory === 'cycle_event'
                              ? 'Женский цикл'
                              : 'Health Fact'}
                          </span>
                        )}
                        <span className="text-gray-300 bg-gray-800 px-2 py-0.5 rounded text-[10px]">
                          Субъект: <strong className="text-white">{msg.stagedCandidate.payload?.subject?.name || 'Я (владелец)'}</strong>
                        </span>
                        <span className="text-gray-300 bg-gray-800 px-2 py-0.5 rounded text-[10px]">
                          Дата: <strong className="text-cyan-300">{msg.stagedCandidate.payload?.dateResolution?.raw || 'сегодня'}</strong>
                        </span>
                      </div>

                      <p className="text-xs text-white font-bold pt-1">{msg.stagedCandidate.title}</p>
                      <p className="text-[11px] text-gray-400 leading-relaxed">{msg.stagedCandidate.description}</p>
                    </div>

                    {/* Schema Validation Indicator */}
                    {msg.stagedCandidate.payload?.schemaValidation && (
                      <div className={`p-2 rounded-lg text-[10px] flex items-center justify-between gap-2 border ${
                        msg.stagedCandidate.payload.schemaValidation.isValid
                          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                          : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                      }`}>
                        <span className="flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          {msg.stagedCandidate.payload.schemaValidation.statusText || 'Валидация схемы пройдена'}
                        </span>
                        <span className="font-mono text-[9px] opacity-80">SCHEMA_OK</span>
                      </div>
                    )}

                    {msg.stagedCandidate.status === 'STAGED' ? (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() =>
                            handleConfirmCandidateInChat(
                              msg.stagedCandidate.id,
                              msg.stagedCandidate.confirmationToken,
                              msg.id
                            )
                          }
                          className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-[11px] rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Подтвердить запись</span>
                        </button>

                        <button
                          onClick={() =>
                            handleRejectCandidateInChat(
                              msg.stagedCandidate.id,
                              msg.stagedCandidate.confirmationToken,
                              msg.id
                            )
                          }
                          className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Сбросить</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] font-bold pt-1">
                        {msg.stagedCandidate.status === 'CONFIRMED' ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Подтверждено и написано в каноническую медкарту
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Запись отклонена и не попала в базу данных
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <span
                  className={`block text-[10px] text-right mt-1 ${
                    isUser ? 'text-slate-800 font-medium' : 'text-gray-500'
                  }`}
                >
                  {msg.timestamp}
                </span>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-3 text-xs text-gray-400 bg-[#14171C] p-3.5 rounded-2xl border border-gray-800 w-fit">
            <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
            <span>{activeBot.name} анализирует вопрос и готовит ответ...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Role-Specific Quick Prompts Bar */}
      <div className="px-3 py-2 bg-[#0F1115] border-t border-gray-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none">
        {activeBot.quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            className="px-3 py-1.5 bg-gray-900 hover:bg-emerald-500/20 hover:text-emerald-300 text-gray-300 border border-gray-800 rounded-xl text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-3 bg-[#14171C] border-t border-gray-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Напиши вопрос для ${activeBot.name}...`}
            className="flex-1 min-w-0 px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-xs sm:text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-800 disabled:text-gray-600 text-slate-950 font-bold rounded-xl shadow-md transition-all cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      <AiToolsGovernanceModal isOpen={isGovernanceOpen} onClose={() => setIsGovernanceOpen(false)} />
    </div>
  );
};
