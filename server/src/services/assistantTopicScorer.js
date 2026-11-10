const aliases = Object.freeze({
  appoint: 'appointment', apointment: 'appointment', appoinment: 'appointment', appointmnt: 'appointment', appt: 'appointment',
  boook: 'book', bookingg: 'booking', sched: 'schedule', scheduel: 'schedule', iskedyul: 'schedule',
  avail: 'available', availble: 'available', avialable: 'available', okk: 'ok',
  rescedule: 'reschedule', reshedule: 'reschedule', reschedul: 'reschedule', resched: 'reschedule',
  palitan: 'palit', ilipat: 'lipat', cancle: 'cancel', kansel: 'cancel', kanselahin: 'cancel', cancelation: 'cancellation',
  pendng: 'pending', confimed: 'confirmed', confirmd: 'confirmed',
  notif: 'notification', notifcation: 'notification', notificaton: 'notification',
  cert: 'certificate', certs: 'certificate', certficate: 'certificate', certifcate: 'certificate', medcert: 'certificate', medcer: 'certificate', sertipiko: 'certificate',
  downlaod: 'download', dowload: 'download', donwload: 'download',
  exipred: 'expired', expried: 'expired', expird: 'expired', expriation: 'expiration', expiratoin: 'expiration',
  presciption: 'prescription', perscription: 'prescription', prescriptin: 'prescription', reseta: 'prescription',
  recrod: 'record', recrods: 'records', docters: 'doctors', servces: 'services',
  pasword: 'password', passwrod: 'password', oassword: 'password', verfication: 'verification', loging: 'login',
  docter: 'doctor', doktor: 'doctor', doc: 'doctor', dok: 'doctor',
  fevr: 'fever', coff: 'cough', dizy: 'dizzy', medecine: 'medicine', diagnos: 'diagnose', salmat: 'salamat', thnks: 'thanks',
  san: 'saan', nasan: 'saan', bat: 'bakit', di: 'hindi', kelangan: 'kailangan',
});

const fuzzyTerms = Object.freeze([
  'appointment', 'booking', 'schedule', 'reschedule', 'cancel', 'cancellation',
  'pending', 'confirmed', 'completed', 'notification', 'certificate', 'password',
  'verification', 'doctor', 'queue', 'arrival', 'profile', 'record', 'login',
  'prescription', 'download', 'expired', 'expiration', 'available', 'allergy',
]);

const topicTerms = Object.freeze({
  booking: Object.freeze({ appointment: 2, book: 3, booking: 3, schedule: 1, doctor: 1, visit: 1, consult: 1, gusto: 1 }),
  reschedule: Object.freeze({ reschedule: 4, move: 2, palit: 3, lipat: 3, wrong: 1, mali: 1, date: 1, araw: 1, appointment: 1, schedule: 1 }),
  cancellation: Object.freeze({ cancel: 4, cancellation: 4, ayoko: 2, appointment: 1, schedule: 1 }),
  status: Object.freeze({ status: 3, pending: 3, confirmed: 3, completed: 3, 'no-show': 3 }),
  queue: Object.freeze({ queue: 3, pila: 3, arrival: 2, checkin: 3, waiting: 2, nandito: 1, priority: 2 }),
  account: Object.freeze({ login: 3, password: 3, otp: 3, verification: 2, verify: 2, email: 1, register: 3, account: 2, how: 1, paano: 1, pano: 1 }),
  records: Object.freeze({ record: 3, records: 3, history: 2, prescription: 3, where: 1, saan: 1, find: 1, view: 1, download: 1 }),
  certificates: Object.freeze({ certificate: 3, expired: 2, expiration: 2, expiry: 2, valid: 1, pdf: 1, download: 1, where: 1, saan: 1, find: 1 }),
  notifications: Object.freeze({ notification: 3, notifications: 3, alert: 2, alerts: 2, how: 1, paano: 1, pano: 1 }),
  portal: Object.freeze({ portal: 3, dashboard: 2, navigation: 2 }),
});

const filipinoMarkers = new Set([
  'ako', 'ano', 'ang', 'ba', 'bakit', 'gusto', 'hindi', 'ibig', 'kailan', 'kailangan',
  'ko', 'mag', 'mga', 'mo', 'ng', 'paano', 'pano', 'palitan', 'para', 'po', 'pwede', 'saan', 'tulong', 'yung', 'tagalog', 'filipino',
]);

function editDistanceAtMostOne(left, right) {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1) return false;
  if (left.length === right.length) {
    const mismatches = [];
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) mismatches.push(index);
      if (mismatches.length > 2) return false;
    }
    if (mismatches.length === 1) return true;
    return mismatches.length === 2
      && mismatches[1] === mismatches[0] + 1
      && left[mismatches[0]] === right[mismatches[1]]
      && left[mismatches[1]] === right[mismatches[0]];
  }
  const [shorter, longer] = left.length < right.length ? [left, right] : [right, left];
  let shortIndex = 0;
  let longIndex = 0;
  let skipped = false;
  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1;
      longIndex += 1;
    } else if (skipped) {
      return false;
    } else {
      skipped = true;
      longIndex += 1;
    }
  }
  return true;
}

function normalizeToken(token) {
  const reduced = token.replace(/(.)\1{2,}/g, '$1$1');
  if (aliases[reduced]) return aliases[reduced];
  if (reduced.length < 5 || /^\d+$/.test(reduced)) return reduced;
  return fuzzyTerms.find((term) => editDistanceAtMostOne(reduced, term)) ?? reduced;
}

export function normalizeAssistantLanguage(message) {
  return message
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/check[ -]?in/g, 'checkin')
    .replace(/no[ -]?show/g, 'no-show')
    .replace(/[^a-z0-9-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeToken)
    .join(' ');
}

export function assistantResponseLanguage(normalizedMessage) {
  return normalizedMessage.split(/\s+/).some((token) => filipinoMarkers.has(token)) ? 'filipino' : 'english';
}

export function scoreAssistantTopics(message) {
  const normalized = normalizeAssistantLanguage(message);
  const tokens = new Set(normalized.split(/\s+/).filter(Boolean));
  const scores = Object.entries(topicTerms).map(([topic, terms]) => {
    const matched = Object.keys(terms).filter((term) => tokens.has(term));
    return { topic, score: matched.reduce((total, term) => total + terms[term], 0), matched };
  }).filter((entry) => entry.score > 0).sort((left, right) => right.score - left.score);
  const language = assistantResponseLanguage(normalized);
  if (!scores.length) return Object.freeze({ kind: 'none', topic: null, candidates: [], language, normalized });
  const [top, second] = scores;
  // Require two connected topic words before choosing a broad intent. Exact
  // high-signal phrases are handled by the gateways first, while this scorer
  // stays conservative for isolated words and genuinely unclear text.
  const topIsStrong = top.score >= 3 && top.matched.length >= 2;
  const exclusiveAppointmentTopics = new Set(['booking', 'reschedule', 'cancellation']);
  const conflict = topIsStrong && second
    && exclusiveAppointmentTopics.has(top.topic)
    && exclusiveAppointmentTopics.has(second.topic)
    && second.score >= 3
    && top.score - second.score <= 1;
  if (conflict) {
    return Object.freeze({ kind: 'conflict', topic: null, candidates: Object.freeze([top.topic, second.topic]), language, normalized });
  }
  if (topIsStrong) return Object.freeze({ kind: 'match', topic: top.topic, candidates: Object.freeze([top.topic]), language, normalized });
  return Object.freeze({ kind: 'clarify', topic: top.topic, candidates: Object.freeze([top.topic]), language, normalized });
}
