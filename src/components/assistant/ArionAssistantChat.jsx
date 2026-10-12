import { useEffect, useRef, useState } from 'react';
import {
  ASSISTANT_MESSAGE_MAX_LENGTH,
  assistantErrorMessage,
  patientAssistantApiService,
} from '../../services/patientAssistantApiService.js';
import '../../styles/arion-assistant.css';

const WELCOME_MESSAGE = "Hi! I'm Arion Assistant. I can help with appointments, portal navigation, notifications, Medical Records, Certificates, and account-related questions.";
const DISCLAIMER = 'Arion Assistant provides clinic and portal guidance and does not replace a Doctor.';

export const ASSISTANT_SUGGESTIONS = Object.freeze([
  { label: 'My Next Appointment', question: 'When is my next appointment?' },
  { label: 'Appointment Status', question: 'What is my appointment status?' },
  { label: 'How to Reschedule', question: 'How do I reschedule?' },
  { label: 'Medical Records', question: 'Where are my Medical Records?' },
  { label: 'Certificates', question: 'Where are my Certificates?' },
  { label: 'Notifications', question: 'How do notifications work?' },
  { label: 'Password Help', question: 'How do I reset my password?' },
  { label: 'How Does the Queue Work?', question: 'How does the queue work?' },
]);

function AssistantIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="6" width="16" height="13" rx="4" />
    <path d="M12 3v3M8.5 11h.01M15.5 11h.01M8.5 15h7" />
  </svg>;
}

function welcomeMessage() {
  return { id: 'assistant-welcome', role: 'assistant', text: WELCOME_MESSAGE };
}

export default function ArionAssistantChat({ service = patientAssistantApiService }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => [welcomeMessage()]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const launcherRef = useRef(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const sequenceRef = useRef(0);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    queueMicrotask(() => inputRef.current?.focus());
    const closeOnEscape = event => {
      if (event.key === 'Escape') closePanel();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, pending, open]);

  function closePanel() {
    setOpen(false);
    queueMicrotask(() => launcherRef.current?.focus());
  }

  function clearChat() {
    if (pending) return;
    setMessages([welcomeMessage()]);
    setDraft('');
    queueMicrotask(() => inputRef.current?.focus());
  }

  async function sendMessage(rawMessage = draft) {
    const message = rawMessage.trim();
    if (pending || !message || message.length > ASSISTANT_MESSAGE_MAX_LENGTH) return;
    const requestId = ++sequenceRef.current;
    setMessages(current => [...current, { id: `patient-${requestId}`, role: 'user', text: message }]);
    setDraft('');
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

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  const validDraft = Boolean(draft.trim()) && draft.length <= ASSISTANT_MESSAGE_MAX_LENGTH;
  return <div className="arion-assistant">
    {!open && <button ref={launcherRef} className="assistant-launcher" type="button" aria-label="Open Arion Assistant" onClick={() => setOpen(true)}>
      <span className="assistant-launcher-icon"><AssistantIcon /></span><span className="assistant-launcher-label">Ask Arion</span>
    </button>}
    {open && <section className="assistant-panel" role="dialog" aria-modal="false" aria-labelledby="assistant-title">
      <header className="assistant-header">
        <span className="assistant-avatar"><AssistantIcon /></span>
        <span className="assistant-heading"><strong id="assistant-title">Arion Assistant</strong><small>AI Clinic Assistant</small></span>
        <button className="assistant-header-action" type="button" onClick={clearChat} disabled={pending || messages.length === 1} aria-label="Clear chat">Clear</button>
        <button className="assistant-header-action assistant-close" type="button" onClick={closePanel} aria-label="Close Arion Assistant">×</button>
      </header>
      <div className="assistant-messages" role="log" aria-live="polite" aria-relevant="additions">
        {messages.map(item => <article key={item.id} className={`assistant-message is-${item.role}${item.error ? ' is-error' : ''}`}>
          <span className="assistant-message-label">{item.role === 'user' ? 'You' : 'Arion Assistant'}</span>
          <p>{item.text}</p>
        </article>)}
        {messages.length === 1 && <div className="assistant-suggestions" aria-label="Suggested questions">
          {ASSISTANT_SUGGESTIONS.map(item => <button key={item.label} type="button" disabled={pending} onClick={() => sendMessage(item.question)}>{item.label}</button>)}
        </div>}
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
