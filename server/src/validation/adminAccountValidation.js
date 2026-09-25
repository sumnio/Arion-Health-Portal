import { httpError } from '../utils/httpError.js';
import { validateObjectId } from './appointmentValidation.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const doctorCreateFields = new Set(['email', 'password', 'display_name', 'contact_number', 'specialty', 'license_number', 'ptr_number', 'signature_path']);
const doctorUpdateFields = new Set(['display_name', 'contact_number', 'specialty', 'license_number', 'ptr_number', 'signature_path']);
const staffCreateFields = new Set(['email', 'password', 'display_name', 'contact_number']);
const staffUpdateFields = new Set(['display_name', 'contact_number']);

function object(body) { if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'INVALID_INPUT', 'Request body must be an object.'); }
function unknown(body, allowed) { const key = Object.keys(body).find((item) => !allowed.has(item)); if (key) throw httpError(400, 'UNSUPPORTED_FIELD', `${key} is not accepted.`); }
function required(value, field) { const result = typeof value === 'string' ? value.trim() : ''; if (!result) throw httpError(400, 'VALIDATION_ERROR', `${field} is required.`); return result; }
function optional(value, field) { if (value == null || value === '') return null; if (typeof value !== 'string') throw httpError(400, 'VALIDATION_ERROR', `${field} must be text.`); return value.trim() || null; }
function email(value) { const result = required(value, 'email').toLowerCase(); if (!emailPattern.test(result)) throw httpError(400, 'VALIDATION_ERROR', 'email must be valid.'); return result; }
function password(value) { if (typeof value !== 'string' || value.length < 8) throw httpError(400, 'VALIDATION_ERROR', 'password must be at least 8 characters.'); return value; }
function page(query = {}) { const value = Number(query.page ?? 1); const limit = Number(query.limit ?? 10); return { page: Number.isInteger(value) && value > 0 ? value : 1, limit: Number.isInteger(limit) && limit > 0 ? Math.min(limit, 50) : 10 }; }

export function validateAdminId(value, field) { return validateObjectId(value, field); }
export function validateDoctorCreate(body = {}) { object(body); unknown(body, doctorCreateFields); return { email: email(body.email), password: password(body.password), display_name: required(body.display_name, 'display_name'), contact_number: required(body.contact_number, 'contact_number'), specialty: required(body.specialty, 'specialty'), license_number: required(body.license_number, 'license_number'), ptr_number: required(body.ptr_number, 'ptr_number'), signature_path: optional(body.signature_path, 'signature_path') }; }
export function validateDoctorUpdate(body = {}) { object(body); unknown(body, doctorUpdateFields); if (!Object.keys(body).length) throw httpError(400, 'VALIDATION_ERROR', 'At least one approved field is required.'); const output = {}; for (const key of Object.keys(body)) output[key] = key === 'signature_path' ? optional(body[key], key) : required(body[key], key); return output; }
export function validateStaffCreate(body = {}) { object(body); unknown(body, staffCreateFields); return { email: email(body.email), password: password(body.password), display_name: required(body.display_name, 'display_name'), contact_number: required(body.contact_number, 'contact_number') }; }
export function validateStaffUpdate(body = {}) { object(body); unknown(body, staffUpdateFields); if (!Object.keys(body).length) throw httpError(400, 'VALIDATION_ERROR', 'At least one approved field is required.'); return Object.fromEntries(Object.keys(body).map((key) => [key, required(body[key], key)])); }
export function validateAdminListQuery(query = {}) { const paging = page(query); return { ...paging, search: String(query.search ?? '').trim() }; }
export function validatePatientListQuery(query = {}) { const result = validateAdminListQuery(query); const status = query.status ?? 'all'; if (!['all', 'active', 'inactive', 'no_account'].includes(status)) throw httpError(400, 'VALIDATION_ERROR', 'status must be active, inactive, no_account, or all.'); return { ...result, status }; }
