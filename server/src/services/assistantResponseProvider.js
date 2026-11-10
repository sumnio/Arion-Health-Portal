import { ASSISTANT_INTENTS } from './assistantIntents.js';
import { ASSISTANT_SAFETY_RESPONSES, getAssistantKnowledgeEntry } from './assistantKnowledgeBase.js';

const conversationalResponses = Object.freeze({
  english: Object.freeze({
    greeting: 'Hi! How can I help—appointments, account access, Records, Certificates, or Notifications?',
    thanks: 'You’re welcome! Let me know if you need help with another Arion clinic or portal question.',
    acknowledgement: 'Got it. What would you like to do next?',
    frustration: 'I understand why that feels frustrating. I’m limited to Arion clinic and portal guidance, but I can still help. Are you trying to book an appointment, change one, or check its status?',
    unclear: 'I didn’t quite understand that. Are you asking about booking an appointment, changing an appointment, account access, Records, Certificates, or Notifications?',
    doctor_availability: 'Are you asking when a Doctor has bookable appointment times, or whether your assigned Doctor is already at the clinic?',
    topic_conflict: 'I found more than one possible request. Do you want to book a new appointment, reschedule one, cancel one, or check its status?',
    booking_clarification: 'Would you like help booking a new appointment?',
    reschedule_clarification: 'Are you trying to reschedule an existing appointment?',
    cancellation_clarification: 'Are you trying to cancel an existing appointment?',
    status_clarification: 'Are you asking what an appointment status means or checking your own current status?',
    queue_clarification: 'Are you asking about clinic arrival, check-in, or the queue order?',
    account_clarification: 'Do you need help with registration, login, email verification, or password recovery?',
    records_clarification: 'Are you trying to find your Medical Records?',
    certificates_clarification: 'Are you trying to find your Medical Certificates?',
    notifications_clarification: 'Do you need help understanding or finding Notifications?',
    portal_clarification: 'Do you need help navigating the Arion Patient Portal?',
    context_rejected: 'No problem. What would you like help with instead?',
    help_request: 'Of course. Do you need help with an appointment, your account, Records, Certificates, Notifications, or clinic information?',
  }),
  filipino: Object.freeze({
    greeting: 'Hello! Paano kita matutulungan—appointments, account access, Records, Certificates, o Notifications?',
    thanks: 'Walang anuman! Sabihin mo lang kung may iba ka pang tanong tungkol sa Arion clinic o portal.',
    acknowledgement: 'Sige. Ano ang gusto mong gawin next?',
    frustration: 'Naiintindihan ko kung bakit nakaka-frustrate iyon. Para lang ako sa Arion clinic at portal guidance, pero matutulungan pa rin kita. Gusto mo bang mag-book, magpalit ng appointment, o tingnan ang status nito?',
    unclear: 'Hindi ko gaanong naintindihan. Tungkol ba ito sa pag-book o pagbabago ng appointment, account access, Records, Certificates, o Notifications?',
    doctor_availability: 'Tinatanong mo ba kung kailan may available na booking time ang Doctor, o kung nasa clinic na ang assigned Doctor mo?',
    topic_conflict: 'May nakita akong higit sa isang posibleng request. Gusto mo bang mag-book, mag-reschedule, magkansela, o tingnan ang appointment status?',
    booking_clarification: 'Gusto mo bang mag-book ng bagong appointment?',
    reschedule_clarification: 'Gusto mo bang ilipat ang schedule ng kasalukuyang appointment?',
    cancellation_clarification: 'Gusto mo bang kanselahin ang kasalukuyang appointment?',
    status_clarification: 'Tinatanong mo ba ang kahulugan ng status o ang kasalukuyang status ng appointment mo?',
    queue_clarification: 'Tungkol ba ito sa pagdating, check-in, o pila sa clinic?',
    account_clarification: 'Kailangan mo ba ng tulong sa registration, login, email verification, o password recovery?',
    records_clarification: 'Hinahanap mo ba ang iyong Medical Records?',
    certificates_clarification: 'Hinahanap mo ba ang iyong Medical Certificates?',
    notifications_clarification: 'Kailangan mo ba ng tulong sa Notifications?',
    portal_clarification: 'Kailangan mo ba ng tulong sa paggamit ng Arion Patient Portal?',
    context_rejected: 'Okay lang. Ano ang gusto mong itanong sa halip?',
    help_request: 'Sige. Kailangan mo ba ng tulong sa appointment, account, Records, Certificates, Notifications, o impormasyon tungkol sa clinic?',
  }),
});

function conversationalReply(classification) {
  const language = classification.language === 'filipino' ? 'filipino' : 'english';
  return conversationalResponses[language][classification.topic]
    ?? conversationalResponses[language].unclear;
}

export function createAssistantResponseProvider() {
  return Object.freeze({
    reply(_message, classification) {
      if (classification.intent === ASSISTANT_INTENTS.HEALTH_OR_CLINICAL) {
        if (classification.language === 'filipino') {
          return classification.emergency ? ASSISTANT_SAFETY_RESPONSES.emergencyFilipino : ASSISTANT_SAFETY_RESPONSES.clinicalFilipino;
        }
        return classification.emergency ? ASSISTANT_SAFETY_RESPONSES.emergency : ASSISTANT_SAFETY_RESPONSES.clinical;
      }
      if (classification.topic === 'unsafe_request') return ASSISTANT_SAFETY_RESPONSES.unsafe;
      if (classification.intent === ASSISTANT_INTENTS.SENSITIVE_OR_UNCLEAR) return ASSISTANT_SAFETY_RESPONSES.unclear;
      if ([ASSISTANT_INTENTS.CONVERSATIONAL, ASSISTANT_INTENTS.CLARIFICATION].includes(classification.intent)) {
        return conversationalReply(classification);
      }
      if (classification.intent === ASSISTANT_INTENTS.UNSUPPORTED) return ASSISTANT_SAFETY_RESPONSES.unsupported;
      if (classification.intent === ASSISTANT_INTENTS.GPT_CONVERSATIONAL) return ASSISTANT_SAFETY_RESPONSES.providerUnavailable;
      if ([
        ASSISTANT_INTENTS.NEXT_APPOINTMENT,
        ASSISTANT_INTENTS.UPCOMING_APPOINTMENTS,
        ASSISTANT_INTENTS.APPOINTMENT_STATUS,
        ASSISTANT_INTENTS.ASSIGNED_DOCTOR,
      ].includes(classification.intent)) return ASSISTANT_SAFETY_RESPONSES.personalizedAppointment;
      if ([
        ASSISTANT_INTENTS.RECENT_NOTIFICATIONS,
        ASSISTANT_INTENTS.UNREAD_NOTIFICATION_COUNT,
      ].includes(classification.intent)) return ASSISTANT_SAFETY_RESPONSES.personalizedNotification;
      if (classification.topic === 'personalized_lookup') return ASSISTANT_SAFETY_RESPONSES.personalizedAppointment;
      if (classification.topic === 'personalized_notifications') return ASSISTANT_SAFETY_RESPONSES.personalizedNotification;
      return getAssistantKnowledgeEntry(classification.topic)?.response ?? ASSISTANT_SAFETY_RESPONSES.unclear;
    },
  });
}

