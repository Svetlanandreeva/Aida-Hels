import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Sparkles, User, Heart, RefreshCw } from 'lucide-react';
import { UserProfile, MedicalDocument, DailyLogEntry, DiaryEntry, Reminder } from '../types';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

interface AiAssistantProps {
  user: UserProfile;
  documents?: MedicalDocument[];
  dailyLogs?: DailyLogEntry[];
  diaryEntries?: DiaryEntry[];
  reminders?: Reminder[];
  pressureLogs?: any[];
}

export const AiAssistant: React.FC<AiAssistantProps> = ({
  user,
  documents = [],
  dailyLogs = [],
  diaryEntries = [],
  reminders = [],
  pressureLogs = [],
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: `Похоже, самое время сделать паузу и позаботиться о себе. Я Аида — твой персональный помощник. Я изучила твои последние записи, показатели сна, давление и дневник. Задавай любой вопрос, и мы вместе во всём разберёмся 🤍`,
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const quickPrompts = [
    'Как моё ментальное состояние?',
    'Что с моим давлением и пульсом?',
    'Оцени мой уровень стресса и сна',
    'Что делать при снижении Витамина D?',
  ];

  const handleSend = async (textToSend?: string) => {
    const promptText = textToSend || input;
    if (!promptText.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptText,
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
        text: data.text || 'Я рядом. Давай попробуем сформулировать вопрос немного иначе 🤍',
        timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: 'Произошёл временно сбой связи. Попробуй отправить сообщение ещё раз через пару секунд.',
        timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[78vh] bg-[#14171C] rounded-3xl border border-gray-800 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-[#0F1115] p-4 sm:p-5 text-white border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base flex items-center gap-2 text-gray-100">
              <span>Аида — Персональный ИИ-помощник</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </h2>
            <p className="text-[11px] text-gray-400">
              Спокойная, тёплая и тактичная поддержка вашего здоровья
            </p>
          </div>
        </div>

        <button
          onClick={() =>
            setMessages([
              {
                id: '1',
                sender: 'ai',
                text: 'Я рядом и готовит выслушать. С чего начнём наше общение? 🤍',
                timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
              },
            ])
          }
          className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-xl transition-colors text-xs flex items-center gap-1 cursor-pointer"
          title="Очистить чат"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0A0B0D]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 max-w-[85%] ${
              msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                msg.sender === 'user'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
              }`}
            >
              {msg.sender === 'user' ? user.fullName.charAt(0) : <Heart className="w-4 h-4 fill-current" />}
            </div>

            <div
              className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed space-y-1 shadow-xs ${
                msg.sender === 'user'
                  ? 'bg-emerald-500 text-slate-950 font-medium rounded-tr-none'
                  : 'bg-[#14171C] text-gray-200 border border-gray-800 rounded-tl-none whitespace-pre-line'
              }`}
            >
              <p>{msg.text}</p>
              <span
                className={`block text-[10px] text-right mt-1 ${
                  msg.sender === 'user' ? 'text-slate-800' : 'text-gray-500'
                }`}
              >
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-[#14171C] p-3 rounded-2xl border border-gray-800 w-fit">
            <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
            <span>Аида изучает твои данные и готовит ответ...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Bar */}
      <div className="p-2 bg-[#0F1115] border-t border-gray-800 flex items-center gap-2 overflow-x-auto">
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            className="px-3 py-1.5 bg-gray-900 hover:bg-emerald-500/20 hover:text-emerald-300 text-gray-300 border border-gray-800 rounded-xl text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer"
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
            placeholder="Спроси Аиду о своём самочувствии, сне или давлении..."
            className="flex-1 min-w-0 px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-xs sm:text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-800 disabled:text-gray-600 text-slate-950 font-bold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
