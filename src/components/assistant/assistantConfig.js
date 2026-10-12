export const PATIENT_ASSISTANT_CONFIG = Object.freeze({
  welcomeMessage: "Hi! I'm Arion Assistant. I can help with appointments, portal navigation, notifications, Medical Records, Certificates, and account-related questions.",
  suggestions: Object.freeze([
    { label: 'My Next Appointment', question: 'When is my next appointment?' },
    { label: 'Appointment Status', question: 'What is my appointment status?' },
    { label: 'How to Reschedule', question: 'How do I reschedule?' },
    { label: 'Medical Records', question: 'Where are my Medical Records?' },
    { label: 'Certificates', question: 'Where are my Certificates?' },
    { label: 'Notifications', question: 'How do notifications work?' },
    { label: 'Password Help', question: 'How do I reset my password?' },
    { label: 'How Does the Queue Work?', question: 'How does the queue work?' },
  ]),
});

export const PUBLIC_ASSISTANT_CONFIG = Object.freeze({
  welcomeMessage: "Hi! I'm Arion Assistant. I can explain registration, login, appointments, email verification, password recovery, and general clinic processes. For personal appointment or account details, please sign in.",
  suggestions: Object.freeze([
    { label: 'How Do I Register?', question: 'How do I register?' },
    { label: 'How Do Appointments Work?', question: 'How do appointments work?' },
    { label: 'What Does Pending Mean?', question: 'What does Pending mean?' },
    { label: 'Verify My Email', question: 'How do I verify my email?' },
    { label: 'Forgot My Password', question: 'I forgot my password' },
    { label: 'How to Reschedule', question: 'How do I reschedule?' },
    { label: 'Medical Records', question: 'What are Medical Records?' },
    { label: 'What Can You Help With?', question: 'What can Arion Assistant help with?' },
  ]),
});
