function question(label, submittedQuestion = label) {
  return Object.freeze({ label, question: submittedQuestion });
}

function category(id, label, questions) {
  return Object.freeze({ id, label, questions: Object.freeze(questions) });
}

export const PATIENT_ASSISTANT_CONFIG = Object.freeze({
  welcomeMessage: "Hi! I'm Arion Assistant. What can I help you with?",
  categories: Object.freeze([
    category('appointments', 'My Appointments', [question('When is my next appointment?'), question('What is my appointment status?'), question('Who is my Doctor?'), question('How do I book an appointment?'), question('How do I reschedule?'), question('How do I cancel?'), question('What does Pending mean?'), question('What does Confirmed mean?'), question('What is No-show?')]),
    category('records', 'Medical Records', [question('Where can I see my Medical Records?'), question('Can I edit my Medical Record?'), question('Who creates my Medical Record?')]),
    category('certificates', 'Certificates', [question('Where can I see my Certificates?'), question('Who issues Certificates?'), question('Can Arion Assistant issue one?', 'Can Arion Assistant issue a Certificate?')]),
    category('notifications', 'Notifications', [question('Do I have unread notifications?'), question('What are my recent notifications?'), question('How do notifications work?'), question('Can I mark notifications as read here?')]),
    category('account', 'Account & Profile', [question('How do I reset my password?'), question('How does email verification work?'), question('I didn’t receive my OTP'), question('How do I edit my profile?'), question('What phone number format should I use?')]),
    category('queue', 'Queue & Arrival', [question('How does the queue work?'), question('How is my arrival confirmed?'), question('What is Urgent priority?'), question('What is Senior/PWD priority?'), question('What is No-show?')]),
    category('about', 'About Arion Assistant', [question('What can you help me with?'), question('Can you diagnose me?'), question('Can you change my appointment?'), question('Can you access another Patient?')]),
  ]),
});

export const PUBLIC_ASSISTANT_CONFIG = Object.freeze({
  welcomeMessage: "Hi! I'm Arion Assistant. I can help you learn how to use the Arion Health Portal.",
  categories: Object.freeze([
    category('getting-started', 'Getting Started', [question('How do I register?'), question('How do I log in?'), question('What can Arion Assistant help with?')]),
    category('appointments', 'Appointments', [question('How do appointments work?'), question('What does Pending mean?'), question('What does Confirmed mean?'), question('How do I reschedule?'), question('How do I cancel?'), question('What is No-show?')]),
    category('account', 'Account Help', [question('How do I verify my email?'), question('I forgot my password'), question('I didn’t receive my OTP'), question('How do I change my password?')]),
    category('records', 'Records & Certificates', [question('What are Medical Records?'), question('What are Certificates?'), question('Where can I view them after signing in?', 'Where can I view Medical Records and Certificates after signing in?')]),
    category('queue', 'Queue & Clinic Process', [question('How does the queue work?'), question('How is arrival confirmed?'), question('What does Senior/PWD priority mean?'), question('What does Urgent priority mean?')]),
    category('about', 'About Arion Assistant', [question('What can you help me with?'), question('Can you access my account?'), question('Can you diagnose me?')]),
  ]),
});
