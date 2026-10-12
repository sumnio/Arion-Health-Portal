import { useEffect, useRef, useState } from 'react';
import {
  ASSISTANT_MESSAGE_MAX_LENGTH,
  assistantErrorMessage,
} from '../../services/assistantApiService.js';
import { patientAssistantApiService } from '../../services/patientAssistantApiService.js';
import { PATIENT_ASSISTANT_CONFIG } from './assistantConfig.js';
import '../../styles/arion-assistant.css';

const DISCLAIMER = 'Arion Assistant provides clinic and portal guidance and does not replace a Doctor.';
export const ASSISTANT_CATEGORIES = PATIENT_ASSISTANT_CONFIG.categories;

function AssistantIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="6" width="16" height="13" rx="4" />
    <path d="M12 3v3M8.5 11h.01M15.5 11h.01M8.5 15h7" />
  </svg>;
}

function welcomeMessage(text) {
  return { id: 'assistant-welcome', role: 'assistant', text };
}

export default function ArionAssistantChat({
  service = patientAssistantApiService,
  welcomeText = PATIENT_ASSISTANT_CONFIG.welcomeMessage,
  categories = PATIENT_ASSISTANT_CONFIG.categories,
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => [welcomeMessage(welcomeText)]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(true);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const launcherRef = useRef(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const firstCategoryRef = useRef(null);
  const firstQuestionRef = useRef(null);
  const sequenceRef = useRef(0);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    queueMicrotask(() => (topicsOpen ? firstCategoryRef.current : inputRef.current)?.focus());
    const closeOnEscape = event => {
      if (event.key === 'Escape') closePanel();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  useEffect(() => {
    if (!open || !topicsOpen) return;
    queueMicrotask(() => (activeCategoryId ? firstQuestionRef.current : firstCategoryRef.current)?.focus());
  }, [activeCategoryId, open, topicsOpen]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, pending, open]);

  function closePanel() {
    setOpen(false);
    queueMicrotask(() => launcherRef.current?.focus());
  }

  function clearChat() {
    if (pending) return;
    setMessages([welcomeMessage(welcomeText)]);
    setDraft('');
    setTopicsOpen(true);
    setActiveCategoryId(null);
    queueMicrotask(() => firstCategoryRef.current?.focus());
  }

  async function sendMessage(rawMessage = draft) {
    const message = rawMessage.trim();
    if (pending || !message || message.length > ASSISTANT_MESSAGE_MAX_LENGTH) return;
    const requestId = ++sequenceRef.current;
    setMessages(current => [...current, { id: `patient-${requestId}`, role: 'user', text: message }]);
    setDraft('');
    setTopicsOpen(false);
    setActiveCategoryId(null);
    setPending(true);
    try {
      const reply = await service.sendMessage(message);
      if (!activeRef.current || sequenceRef.current !== requestId) return;
      setMessages(current => [...current, { id: `assistant-${requestId}`, role: 'assistant', text: reply }]);
    } catch (error) {
      if (!activeRef.current || sequenceRef.current !== requestId) return;
      setMessages(current => [...current, { id: `assistant-error-${requestId}`, role: 'assistant', text: assistantErrorMessage(error), error: true }]);
    } finally {
      if (activeRef.current && sequenceRef.current === requestId) setPending(false);
    }
  }

  function selectCategory(categoryId) {
    setActiveCategoryId(categoryId);
    queueMicrotask(() => firstQuestionRef.current?.focus());
  }

  function showAllTopics() {
    setTopicsOpen(true);
    setActiveCategoryId(null);
    queueMicrotask(() => firstCategoryRef.current?.focus());
  }

  function backToTopics() {
    setActiveCategoryId(null);
    queueMicrotask(() => firstCategoryRef.current?.focus());
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  const validDraft = Boolean(draft.trim()) && draft.length <= ASSISTANT_MESSAGE_MAX_LENGTH;
  const activeCategory = categories.find(category => category.id === activeCategoryId) ?? null;
  return <div className="arion-assistant">
    {!open && <button ref={launcherRef} className="assistant-launcher" type="button" aria-label="Open Arion Assistant" onClick={() => setOpen(true)}>
      <span className="assistant-launcher-icon"><AssistantIcon /></span><span className="assistant-launcher-label">Ask Arion</span>
    </button>}
    {open && <section className="assistant-panel" role="dialog" aria-modal="false" aria-labelledby="assistant-title">
      <header className="assistant-header">
        <span className="assistant-avatar"><AssistantIcon /></span>
        <span className="assistant-heading"><strong id="assistant-title">Arion Assistant</strong><small>AI Clinic Assistant</small></span>
        <button className="assistant-header-action" type="button" onClick={clearChat} disabled={pending || (messages.length === 1 && topicsOpen && !activeCategory)} aria-label="Clear chat">Clear</button>
        <button className="assistant-header-action assistant-close" type="button" onClick={closePanel} aria-label="Close Arion Assistant">×</button>
      </header>
      <div className="assistant-messages" role="log" aria-live="polite" aria-relevant="additions">
        {messages.map(item => <article key={item.id} className={`assistant-message is-${item.role}${item.error ? ' is-error' : ''}`}>
          <span className="assistant-message-label">{item.role === 'user' ? 'You' : 'Arion Assistant'}</span>
          <p>{item.text}</p>
        </article>)}
        {topicsOpen && <section className="assistant-guidance" aria-label="Assistant topics">
          {!activeCategory && <>
            <h3>Choose a topic</h3>
            <div className="assistant-categories">
              {categories.map((category, index) => <button ref={index === 0 ? firstCategoryRef : null} key={category.id} type="button" disabled={pending} onClick={() => selectCategory(category.id)}>{category.label}</button>)}
            </div>
          </>}
          {activeCategory && <>
            <button className="assistant-topics-back" type="button" onClick={backToTopics}>← Back to topics</button>
            <h3>{activeCategory.label}</h3>
            <div className="assistant-questions">
              {activeCategory.questions.map((item, index) => <button ref={index === 0 ? firstQuestionRef : null} key={item.label} type="button" disabled={pending} onClick={() => sendMessage(item.question)}>{item.label}</button>)}
            </div>
          </>}
        </section>}
        {!topicsOpen && !pending && <button className="assistant-browse-topics" type="button" onClick={showAllTopics}>Browse topics</button>}
        {pending && <div className="assistant-thinking" role="status"><span aria-hidden="true">•••</span> Arion Assistant is thinking...</div>}
        <div ref={endRef} />
      </div>
      <footer className="assistant-composer">
        <p className="assistant-disclaimer">{DISCLAIMER}</p>
        <div className="assistant-input-row">
          <textarea ref={inputRef} value={draft} maxLength={ASSISTANT_MESSAGE_MAX_LENGTH} rows="2" placeholder="Ask Arion Assistant..." aria-label="Message Arion Assistant" disabled={pending} onChange={event => setDraft(event.target.value)} onKeyDown={handleKeyDown} />
          <button type="button" onClick={() => sendMessage()} disabled={pending || !validDraft} aria-label="Send message">Send</button>
        </div>
        {draft.length >= 700 && <span className="assistant-character-count" aria-live="polite">{draft.length}/{ASSISTANT_MESSAGE_MAX_LENGTH}</span>}
      </footer>
    </section>}
  </div>;
}
