import { httpError } from '../utils/httpError.js';
import { validateObjectId } from './appointmentValidation.js';
import { boundedText, INPUT_LIMITS, queryInteger, queryText, validateQueryKeys } from './inputValidation.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const doctorCreateFields = new Set(['email', 'password', 'display_name', 'contact_number', 'specialty', 'license_number', 'ptr_number', 'signature_path']);
const doctorUpdateFields = new Set(['display_name', 'contact_number', 'specialty', 'license_number', 'ptr_number', 'signature_path']);
const staffCreateFields = new Set(['email', 'password', 'display_name', 'contact_number']);
const staffUpdateFields = new Set(['display_name', 'contact_number']);

function object(body) { if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'INVALID_INPUT', 'Request body must be an object.'); }
function unknown(body, allowed) { const key = Object.keys(body).find((item) => !allowed.has(item)); if (key) throw httpError(400, 'UNSUPPORTED_FIELD', `${key} is not accepted.`); }
function fieldLimit(field) { if (field === 'display_name') return INPUT_LIMITS.name; if (field === 'contact_number') return INPUT_LIMITS.contact; if (field === 'signature_path') return INPUT_LIMITS.path; return INPUT_LIMITS.shortText; }
function required(value, field) { return boundedText(value, field, fieldLimit(field)); }
function optional(value, field) { return boundedText(value, field, fieldLimit(field), { optional: true }); }
function email(value) { const result = boundedText(value, 'email', INPUT_LIMITS.email).toLowerCase(); if (!emailPattern.test(result)) throw httpError(400, 'VALIDATION_ERROR', 'email must be valid.'); return result; }
function password(value) { if (typeof value !== 'string' || value.length < 8 || value.length > INPUT_LIMITS.password) throw httpError(400, 'VALIDATION_ERROR', `password must be from 8 through ${INPUT_LIMITS.password} characters.`); return value; }
function page(query = {}) { return { page: queryInteger(query.page, 'page', { defaultValue: 1, max: 1_000_000 }), limit: queryInteger(query.limit, 'limit', { defaultValue: 10, max: 50 }) }; }

export function validateAdminId(value, field) { return validateObjectId(value, field); }
export function validateDoctorCreate(body = {}) { object(body); unknown(body, doctorCreateFields); return { email: email(body.email), password: password(body.password), display_name: required(body.display_name, 'display_name'), contact_number: required(body.contact_number, 'contact_number'), specialty: required(body.specialty, 'specialty'), license_number: required(body.license_number, 'license_number'), ptr_number: required(body.ptr_number, 'ptr_number'), signature_path: optional(body.signature_path, 'signature_path') }; }
export function validateDoctorUpdate(body = {}) { object(body); unknown(body, doctorUpdateFields); if (!Object.keys(body).length) throw httpError(400, 'VALIDATION_ERROR', 'At least one approved field is required.'); const output = {}; for (const key of Object.keys(body)) output[key] = key === 'signature_path' ? optional(body[key], key) : required(body[key], key); return output; }
export function validateStaffCreate(body = {}) { object(body); unknown(body, staffCreateFields); return { email: email(body.email), password: password(body.password), display_name: required(body.display_name, 'display_name'), contact_number: required(body.contact_number, 'contact_number') }; }
export function validateStaffUpdate(body = {}) { object(body); unknown(body, staffUpdateFields); if (!Object.keys(body).length) throw httpError(400, 'VALIDATION_ERROR', 'At least one approved field is required.'); return Object.fromEntries(Object.keys(body).map((key) => [key, required(body[key], key)])); }
export function validateAdminListQuery(query = {}) { validateQueryKeys(query, new Set(['search', 'page', 'limit'])); const paging = page(query); return { ...paging, search: queryText(query.search, 'search') }; }
export function validatePatientListQuery(query = {}) { validateQueryKeys(query, new Set(['search', 'status', 'page', 'limit'])); const paging = page(query); const search = queryText(query.search, 'search'); const status = query.status ?? 'all'; if (Array.isArray(status) || typeof status !== 'string' || !['all', 'active', 'inactive', 'no_account'].includes(status)) throw httpError(400, 'VALIDATION_ERROR', 'status must be active, inactive, no_account, or all.'); return { ...paging, search, status }; }
