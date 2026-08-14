import React, { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, Copy, Heart, RefreshCw, Send, Sparkles, XCircle } from 'lucide-react';
import { DailyLogEntry, DiaryEntry, MedicalDocument, Reminder, UserProfile } from '../types';
import './AiAssistantV2.css';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
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

const QUICK_PROMPTS = [
  'Что изменилось в моих показателях?',
  'Есть ли что-то, на что стоит обратить внимание?',
  'Помоги разобраться с последними анализами',
  'Что мне полезно добавить в историю здоровья?',
];

const timeNow = () => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export const AiAssistant: React.FC<AiAssistantProps> = ({
  user,
  documents = [],
  dailyLogs = [],
  diaryEntries = [],
  reminders = [],
  pressureLogs = [],
}) => {
  const storageKey = 'aida_chat_messages_v2';
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {}
    return [{
      id: 'welcome',
      sender: 'ai',
      text: 'Привет. Я Аида. Могу помочь разобраться в ваших данных о здоровье, объяснить изменения и подготовить вопросы к врачу. Я не буду придумывать показатели, которых у вас нет.',
      timestamp: timeNow(),
    }];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages)); } catch {}
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleClear = () => {
    const fresh: Message = {
      id: Date.now().toString(),
      sender: 'ai',
      text: 'Начнём заново. Расскажите, что вас сейчас интересует.',
      timestamp: timeNow(),
    };
    setMessages([fresh]);
    try { localStorage.removeItem(storageKey); } catch {}
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {}
  };

  const confirmCandidate = async (candidate: any, messageId: string) => {
    if (!candidate?.id || !candidate?.confirmationToken) return;
    try {
      const response = await fetch('/api/ai/candidates/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: candidate.id, confirmationToken: candidate.confirmationToken }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Не удалось сохранить запись');
      setMessages((prev) => prev.map((m) => m.id === messageId
        ? { ...m, stagedCandidate: { ...m.stagedCandidate, status: 'CONFIRMED' } }
        : m));
    } catch (error: any) {
      setMessages((prev) => [...prev, {
        id: `${Date.now()}-save-error`,
        sender: 'ai',
        text: error?.message || 'Не удалось сохранить запись. Попробуйте ещё раз.',
        timestamp: timeNow(),
      }]);
    }
  };

  const rejectCandidate = async (candidate: any, messageId: string) => {
    if (!candidate?.id || !candidate?.confirmationToken) return;
    try {
      await fetch('/api/ai/candidates/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: candidate.id,
          confirmationToken: candidate.confirmationToken,
          reason: 'Пользователь решил не сохранять запись',
        }),
      });
    } finally {
      setMessages((prev) => prev.map((m) => m.id === messageId
        ? { ...m, stagedCandidate: { ...m.stagedCandidate, status: 'REJECTED' } }
        : m));
    }
  };

  const send = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: timeNow(),
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    if (!preset) setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          botRoleId: 'aida',
          history: nextMessages.slice(-12).map((message) => ({
            sender: message.sender,
            role: message.sender === 'user' ? 'user' : 'model',
            text: message.text,
          })),
          context: { user, documents, dailyLogs, diaryEntries, reminders, pressureLogs },
        }),
      });
      const data = await response.json();
      setMessages((prev) => [...prev, {
        id: `${Date.now()}-ai`,
        sender: 'ai',
        text: data.text || 'Сейчас у меня недостаточно данных для персонального вывода. Можете добавить измерение, анализ или описать симптом.',
        timestamp: timeNow(),
        stagedCandidate: data.stagedCandidate,
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        id: `${Date.now()}-error`,
        sender: 'ai',
        text: 'Не получилось получить ответ. Ваши данные не изменены — попробуйте отправить сообщение ещё раз.',
        timestamp: timeNow(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const displayName = user.fullName?.trim().split(' ')[0] || 'Вы';

  return (
    <section className="aida-chat-v2">
      <header className="aida-chat-v2__header">
        <div className="aida-chat-v2__identity">
          <div className="aida-chat-v2__avatar"><Heart size={22}/></div>
          <div>
            <div className="aida-chat-v2__title-row"><h1>Аида</h1><span>ИИ-ассистент здоровья</span></div>
            <p>Объясняет ваши данные понятным языком и не делает выводов без источников.</p>
          </div>
        </div>
        <button className="aida-chat-v2__clear" onClick={handleClear} title="Очистить чат">
          <RefreshCw size={16}/><span>Новый диалог</span>
        </button>
      </header>

      <div className="aida-chat-v2__body">
        <div className="aida-chat-v2__messages">
          {messages.map((message) => {
            const isUser = message.sender === 'user';
            const candidate = message.stagedCandidate;
            return (
              <div className={`aida-chat-v2__row ${isUser ? 'is-user' : 'is-ai'}`} key={message.id}>
                {!isUser && <div className="aida-chat-v2__mini-avatar"><Sparkles size={15}/></div>}
                <div className={`aida-chat-v2__bubble ${isUser ? 'is-user' : 'is-ai'}`}>
                  {!isUser && <div className="aida-chat-v2__bubble-head"><b>Аида</b><button onClick={() => handleCopy(message.id, message.text)}>{copiedId === message.id ? <Check size={14}/> : <Copy size={14}/>}</button></div>}
                  <p>{message.text}</p>

                  {candidate && (
                    <div className="aida-chat-v2__candidate">
                      <div className="aida-chat-v2__candidate-head">
                        <div><span>Проверьте перед сохранением</span><h3>{candidate.title || 'Новая запись о здоровье'}</h3></div>
                        {candidate.status === 'CONFIRMED' && <CheckCircle2 size={20}/>} 
                        {candidate.status === 'REJECTED' && <XCircle size={20}/>} 
                      </div>
                      {candidate.description && <p>{candidate.description}</p>}
                      {candidate.payload?.factCategory && <small>Тип записи: {candidate.payload.factCategory === 'measurement' ? 'измерение' : candidate.payload.factCategory === 'symptom' ? 'симптом' : candidate.payload.factCategory === 'medication' ? 'лекарство' : candidate.payload.factCategory === 'cycle_event' ? 'событие цикла' : 'данные здоровья'}</small>}
                      {candidate.status === 'STAGED' && (
                        <div className="aida-chat-v2__candidate-actions">
                          <button className="primary" onClick={() => confirmCandidate(candidate, message.id)}>Сохранить</button>
                          <button onClick={() => rejectCandidate(candidate, message.id)}>Не сохранять</button>
                        </div>
                      )}
                      {candidate.status === 'CONFIRMED' && <div className="aida-chat-v2__saved">Сохранено в историю здоровья</div>}
                      {candidate.status === 'REJECTED' && <div className="aida-chat-v2__rejected">Запись не сохранена</div>}
                    </div>
                  )}

                  <time>{message.timestamp}</time>
                </div>
                {isUser && <div className="aida-chat-v2__user-avatar">{displayName.charAt(0).toUpperCase()}</div>}
              </div>
            );
          })}
          {isLoading && <div className="aida-chat-v2__thinking"><Sparkles size={16}/><span>Аида анализирует доступные данные…</span></div>}
          <div ref={endRef}/>
        </div>
      </div>

      <div className="aida-chat-v2__quick">
        {QUICK_PROMPTS.map((prompt) => <button key={prompt} onClick={() => send(prompt)}>{prompt}</button>)}
      </div>

      <form className="aida-chat-v2__composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          placeholder="Напишите о самочувствии, симптоме, анализе или измерении…"
          rows={1}
        />
        <button type="submit" disabled={isLoading || !input.trim()} aria-label="Отправить"><Send size={19}/></button>
      </form>
      <footer className="aida-chat-v2__note">Аида помогает ориентироваться в данных и не заменяет врача или экстренную помощь.</footer>
    </section>
  );
};

export default AiAssistant;
