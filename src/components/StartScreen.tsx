import React, { useState } from 'react';
import { ArrowRight, Brain, Check, ChevronDown, Dna, FileText, HeartPulse, History, LockKeyhole, MessageCircle, Pill, ShieldCheck, Sparkles, Target, TestTube2, TimerReset } from 'lucide-react';
import { AIDA_DNA, AIDA_LOGO } from '../assets/aidaBrandAssets';
import './AidaRedesign.css';

interface StartScreenProps {
  onStartQuestionnaire: () => void;
  onGoToDashboard: () => void;
  onLoginClick: () => void;
  isAuthenticated: boolean;
}

const benefits = [
  ['Единый профиль здоровья', 'Одна понятная картина вместо разрозненных заметок.', HeartPulse],
  ['Все данные в одном месте', 'Анализы, симптомы, давление, сон и лекарства.', FileText],
  ['Персональный анализ', 'Наблюдения формируются на основе вашей истории.', Sparkles],
  ['Отслеживание динамики', 'Изменения видны во времени и связаны между собой.', TimerReset],
] as const;
const modules = [
  ['Организм', HeartPulse], ['Анализы', TestTube2], ['Давление', Target], ['Психика', Brain],
  ['Лекарства', Pill], ['Женское здоровье', Dna], ['ИИ-ассистент Аида', MessageCircle],
  ['Задачи', Check], ['История здоровья', History],
] as const;
const faq = [
  ['Что такое Аида?', 'Цифровой ассистент, который объединяет данные здоровья, находит взаимосвязи и объясняет персональные наблюдения.'],
  ['Это медицинский диагноз?', 'Нет. Аида помогает структурировать информацию и подготовиться к разговору со специалистом.'],
  ['Какие данные можно добавить?', 'Анализы, симптомы, давление, сон, настроение, лекарства, цикл и заметки.'],
  ['Как формируются выводы?', 'На основе истории пользователя и связей между разными типами данных.'],
  ['Можно удалить данные?', 'Да. Пользователь сохраняет контроль над своим профилем и историей.'],
  ['Есть ли бесплатный доступ?', 'Да, начать работу с базовым профилем можно бесплатно.'],
] as const;

export const StartScreen: React.FC<StartScreenProps> = ({ onStartQuestionnaire, onGoToDashboard, onLoginClick, isAuthenticated }) => {
  const [openFaq, setOpenFaq] = useState(0);
  const start = isAuthenticated ? onGoToDashboard : onStartQuestionnaire;
  return (
    <div className="aida-promo">
      <header className="aida-promo-header">
        <img className="aida-logo" src={AIDA_LOGO} alt="Аида" />
        <nav><a href="#benefits">Преимущества</a><a href="#difference">Отличия</a><a href="#how">Как работает</a><a href="#features">Функционал</a><a href="#faq">FAQ</a></nav>
        <div className="aida-header-actions">
          {!isAuthenticated && <button className="aida-link-btn" onClick={onLoginClick}>Войти</button>}
          <button className="aida-btn aida-btn-small" onClick={start}>{isAuthenticated ? 'Личный кабинет' : 'Начать бесплатно'}</button>
        </div>
      </header>

      <main className="aida-promo-stack">
        <section className="aida-hero">
          <div className="aida-hero-copy">
            <div className="aida-kicker"><i /> Цифровой профиль здоровья</div>
            <h1>Цифровой ассистент здоровья нового поколения.</h1>
            <p>Аида объединяет медицинские данные, самочувствие и привычки, находит взаимосвязи и объясняет изменения понятным языком.</p>
            <div className="aida-buttons">
              <button className="aida-btn" onClick={start}>Начать бесплатно <ArrowRight size={18} /></button>
              <button className="aida-btn-secondary" onClick={onGoToDashboard}>Попробовать демо-интерфейс</button>
            </div>
            <small className="aida-trust"><ShieldCheck size={17} /> Данные доступны только вам</small>
          </div>
          <div className="aida-hero-visual">
            <span className="aida-orbit orbit-one" /><span className="aida-orbit orbit-two" />
            <img className="aida-dna" src={AIDA_DNA} alt="Объёмная модель ДНК" />
            <div className="aida-float status"><small>Состояние</small><b>Нет данных</b><span>После заполнения профиля</span></div>
            <div className="aida-float marker"><em>01</em><span><b>Биомаркеры</b><small>Нет данных</small></span></div>
            <div className="aida-float summary"><em>02</em><span><b>ИИ-итог дня</b><small>Появится после заполнения</small></span></div>
          </div>
        </section>

        <section className="aida-section aida-benefits" id="benefits">
          <div><div className="aida-kicker">01 / Преимущества</div><h2>Всё важное<br />собрано вместе.</h2><p>От первого показателя до персонального наблюдения — без потери контекста.</p></div>
          <div className="aida-grid-two">{benefits.map(([title, text, Icon], i) => <article className="aida-card" key={title}><span>0{i + 1}</span><div className="aida-icon"><Icon size={22}/></div><h3>{title}</h3><p>{text}</p></article>)}</div>
        </section>

        <section className="aida-section aida-difference" id="difference">
          <div className="aida-wide-title"><div className="aida-kicker">02 / Что отличает Аиду</div><h2>Аида видит не отдельные цифры,<br />а связи между ними.</h2><p>Каждое наблюдение содержит объяснение: какие данные повлияли на вывод.</p></div>
          <div className="aida-data-map">
            <div className="aida-map-core"><Sparkles size={22}/><b>Единый профиль</b><small>История пользователя</small></div>
            {['Анализы','Симптомы','Давление','Психика','Лекарства','Цикл'].map((x,i)=><span className={`satellite s${i+1}`} key={x}>{x}</span>)}
          </div>
          <div className="aida-notes"><span><b>01</b> Связывает разные данные</span><span><b>02</b> Учитывает историю</span><span><b>03</b> Объясняет каждый вывод</span></div>
        </section>

        <section className="aida-section aida-how" id="how">
          <div><div className="aida-kicker">03 / Как это работает</div><h2>Пять шагов<br />к ясной картине.</h2><p>Профиль становится полезнее с каждым новым наблюдением.</p><button className="aida-btn" onClick={start}>Создать профиль <ArrowRight size={18}/></button></div>
          <ol>{['Добавление медицинских данных','Объединение сведений в единый профиль','Анализ взаимосвязей между событиями','Формирование персональных наблюдений','Отслеживание изменений во времени'].map((x,i)=><li key={x}><b>0{i+1}</b>{x}</li>)}</ol>
        </section>

        <section className="aida-section" id="features">
          <div className="aida-center-title"><div className="aida-kicker">04 / Функционал</div><h2>Один профиль. Девять связанных разделов.</h2><p>Каждый модуль дополняет общую картину здоровья.</p></div>
          <div className="aida-grid-three">{modules.map(([title, Icon],i)=><article className="aida-module" key={title}><span>0{i+1}</span><div className="aida-icon"><Icon size={21}/></div><h3>{title}</h3><p>Данные, динамика и понятные наблюдения.</p></article>)}</div>
        </section>

        <section className="aida-stats">{[['9','связанных разделов'],['1','единый профиль здоровья'],['5','шагов к ясной картине'],['0','выдуманных показателей']].map(([v,l])=><div key={l}><b>{v}</b><span>{l}</span></div>)}</section>

        <section className="aida-section">
          <div className="aida-wide-title"><div className="aida-kicker">05 / Отзывы и сценарии</div><h2>Аида помогает видеть<br />здоровье целиком.</h2><p>Примеры взаимодействия — без вымышленных медицинских обещаний.</p></div>
          <div className="aida-grid-three aida-quotes">{['Я наконец вижу, как сон и стресс связаны с моим самочувствием.','После анализов Аида объяснила, какие показатели требуют внимания.','Напоминания и история помогают не терять важные наблюдения.'].map(x=><blockquote key={x}>“<p>{x}</p><footer>Пример пользовательского сценария</footer></blockquote>)}</div>
        </section>

        <section className="aida-section aida-security">
          <div><div className="aida-kicker">06 / Безопасность</div><h2>Ваши данные —<br />только ваши.</h2><p>Полный контроль пользователя, прозрачность действий и понятное управление доступом.</p><div className="aida-pills"><span>Контроль доступа</span><span>Прозрачные выводы</span><span>История изменений</span></div></div>
          <div className="aida-security-orb"><div><LockKeyhole size={48}/></div></div>
        </section>

        <section className="aida-section aida-faq" id="faq">
          <div><div className="aida-kicker">07 / FAQ</div><h2>Вопросы об Аиде</h2><p>Коротко о данных, подключении и возможностях сервиса.</p></div>
          <div className="aida-faq-list">{faq.map(([q,a],i)=><button key={q} onClick={()=>setOpenFaq(openFaq===i?-1:i)} aria-expanded={openFaq===i}><span><b>{q}</b>{openFaq===i&&<p>{a}</p>}</span><ChevronDown size={20}/></button>)}</div>
        </section>

        <section className="aida-final">
          <div><div className="aida-kicker">Аида рядом</div><h2>Начните понимать<br/>своё здоровье сегодня.</h2></div>
          <div><p>Соберите первый цифровой профиль — бесплатно.</p><button className="aida-btn" onClick={start}>Начать бесплатно <ArrowRight size={18}/></button></div>
        </section>
      </main>

      <footer className="aida-footer"><div><img src={AIDA_LOGO} alt="Аида"/><p>Ваше здоровье • единая система</p></div><nav><a href="#benefits">Преимущества</a><a href="#how">Как это работает</a><a href="#features">Функционал</a><a href="#faq">FAQ</a></nav><nav><a href="#">Политика конфиденциальности</a><a href="#">Пользовательское соглашение</a><a href="mailto:support@aida.health">Контакты</a></nav><small>© 2026 Аида. Информация в сервисе не заменяет консультацию врача.</small></footer>
    </div>
  );
};
