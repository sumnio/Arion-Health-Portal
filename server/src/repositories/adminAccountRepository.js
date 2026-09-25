import mongoose from 'mongoose';
import { AuthAccount, Doctor, Patient, Staff, UserProfile } from '../models/index.js';

async function withFallback(createInTransaction, createWithoutTransaction, cleanup) {
  const session = await mongoose.startSession();
  try {
    try { let result; await session.withTransaction(async () => { result = await createInTransaction(session); }); return result; }
    catch (error) {
      const unavailable = error?.code === 20 || /Transaction numbers are only allowed|replica set/i.test(error?.message ?? '');
      if (!unavailable) throw error;
      try { return await createWithoutTransaction(); } catch (fallbackError) { await cleanup(); throw fallbackError; }
    }
  } finally { await session.endSession(); }
}
async function accountEmails(profileIds) { const accounts = await AuthAccount.find({ user_profile_id: { $in: profileIds } }).select('user_profile_id email').lean(); return new Map(accounts.map((item) => [String(item.user_profile_id), item.email])); }
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function phoneRegex(value) { const digits = value.replace(/\D/g, ''); return digits.length >= 3 ? new RegExp(digits.split('').join('\\D*')) : null; }

export const adminAccountRepository = {
  async findAccountByEmail(email) { return AuthAccount.findOne({ email }).select('_id').lean(); },
  async createDoctorAccount(data) {
    let profileId;
    const create = async (session) => {
      const options = session ? { session } : undefined;
      const [profile] = await UserProfile.create([{ display_name: data.display_name, contact_number: data.contact_number, role: 'doctor', status: 'active' }], options);
      profileId = profile._id;
      const [account] = await AuthAccount.create([{ user_profile_id: profile._id, email: data.email, password_hash: data.password_hash }], options);
      const [doctor] = await Doctor.create([{ user_profile_id: profile._id, specialty: data.specialty, license_number: data.license_number, ptr_number: data.ptr_number, signature_path: data.signature_path }], options);
      return { profile: profile.toObject(), account: account.toObject(), roleProfile: doctor.toObject() };
    };
    return withFallback((session) => create(session), () => create(), async () => { if (profileId) { await AuthAccount.deleteMany({ user_profile_id: profileId }); await Doctor.deleteMany({ user_profile_id: profileId }); await UserProfile.deleteOne({ _id: profileId }); } });
  },
  async createStaffAccount(data) {
    let profileId;
    const create = async (session) => { const options = session ? { session } : undefined; const [profile] = await UserProfile.create([{ display_name: data.display_name, contact_number: data.contact_number, role: 'staff', status: 'active' }], options); profileId = profile._id; const [account] = await AuthAccount.create([{ user_profile_id: profile._id, email: data.email, password_hash: data.password_hash }], options); const [staff] = await Staff.create([{ user_profile_id: profile._id }], options); return { profile: profile.toObject(), account: account.toObject(), roleProfile: staff.toObject() }; };
    return withFallback((session) => create(session), () => create(), async () => { if (profileId) { await AuthAccount.deleteMany({ user_profile_id: profileId }); await Staff.deleteMany({ user_profile_id: profileId }); await UserProfile.deleteOne({ _id: profileId }); } });
  },
  async listDoctors({ search, page, limit }) { const pattern = new RegExp(escapeRegex(search), 'i'); let doctors = await Doctor.find({}).populate({ path: 'user_profile_id', select: 'display_name contact_number status created_at updated_at' }).sort({ created_at: -1 }).lean(); if (search) doctors = doctors.filter((item) => pattern.test(item.user_profile_id?.display_name ?? '') || pattern.test(item.user_profile_id?.contact_number ?? '') || pattern.test(item.specialty) || pattern.test(item.license_number) || pattern.test(item.ptr_number)); const total = doctors.length; const items = doctors.slice((page - 1) * limit, page * limit); const emails = await accountEmails(items.map((item) => item.user_profile_id?._id).filter(Boolean)); return { items: items.map((item) => ({ ...item, email: emails.get(String(item.user_profile_id?._id)) ?? null })), total, page, limit }; },
  async findDoctorById(id) { const doctor = await Doctor.findById(id).populate({ path: 'user_profile_id', select: 'display_name contact_number status created_at updated_at' }).lean(); if (!doctor) return null; const emails = await accountEmails([doctor.user_profile_id?._id]); return { ...doctor, email: emails.get(String(doctor.user_profile_id?._id)) ?? null }; },
  async updateDoctor(id, profileUpdates, doctorUpdates) { const doctor = await Doctor.findById(id).lean(); if (!doctor) return null; if (Object.keys(profileUpdates).length) await UserProfile.updateOne({ _id: doctor.user_profile_id, role: 'doctor' }, { $set: profileUpdates }, { runValidators: true }); if (Object.keys(doctorUpdates).length) await Doctor.updateOne({ _id: id }, { $set: doctorUpdates }, { runValidators: true }); return this.findDoctorById(id); },
  async setDoctorStatus(id, status) { const doctor = await Doctor.findById(id).lean(); if (!doctor) return null; await UserProfile.updateOne({ _id: doctor.user_profile_id, role: 'doctor' }, { $set: { status } }, { runValidators: true }); return this.findDoctorById(id); },
  async listStaff({ search, page, limit }) { const staff = await Staff.find({}).populate({ path: 'user_profile_id', match: search ? { $or: [{ display_name: new RegExp(escapeRegex(search), 'i') }, { contact_number: new RegExp(escapeRegex(search), 'i') }] } : {}, select: 'display_name contact_number status created_at updated_at' }).sort({ created_at: -1 }).lean(); const filtered = search ? staff.filter((item) => item.user_profile_id) : staff; const total = filtered.length; const items = filtered.slice((page - 1) * limit, page * limit); const emails = await accountEmails(items.map((item) => item.user_profile_id?._id).filter(Boolean)); return { items: items.map((item) => ({ ...item, email: emails.get(String(item.user_profile_id?._id)) ?? null })), total, page, limit }; },
  async findStaffById(id) { const staff = await Staff.findById(id).populate({ path: 'user_profile_id', select: 'display_name contact_number status created_at updated_at' }).lean(); if (!staff) return null; const emails = await accountEmails([staff.user_profile_id?._id]); return { ...staff, email: emails.get(String(staff.user_profile_id?._id)) ?? null }; },
  async updateStaff(id, updates) { const staff = await Staff.findById(id).lean(); if (!staff) return null; await UserProfile.updateOne({ _id: staff.user_profile_id, role: 'staff' }, { $set: updates }, { runValidators: true }); return this.findStaffById(id); },
  async setStaffStatus(id, status) { const staff = await Staff.findById(id).lean(); if (!staff) return null; await UserProfile.updateOne({ _id: staff.user_profile_id, role: 'staff' }, { $set: { status } }, { runValidators: true }); return this.findStaffById(id); },
  async listPatients({ search, status, page, limit }) { const pattern = new RegExp(escapeRegex(search), 'i'); const phone = phoneRegex(search); const query = search ? { $or: [{ full_name: pattern }, { contact_number: phone ?? pattern }] } : {}; let patients = await Patient.find(query).populate({ path: 'user_profile_id', select: 'display_name contact_number status created_at updated_at role' }).sort({ full_name: 1 }).lean(); patients = patients.filter((item) => status === 'all' || (status === 'no_account' ? !item.user_profile_id : item.user_profile_id?.status === status)); const total = patients.length; return { items: patients.slice((page - 1) * limit, page * limit), total, page, limit }; },
  async findPatientById(id) { return Patient.findById(id).populate({ path: 'user_profile_id', select: 'display_name contact_number status created_at updated_at role' }).lean(); },
  async setPatientStatus(id, status) { const patient = await Patient.findById(id).lean(); if (!patient) return null; if (!patient.user_profile_id) return { noAccount: true, patient }; await UserProfile.updateOne({ _id: patient.user_profile_id, role: 'patient' }, { $set: { status } }, { runValidators: true }); return this.findPatientById(id); },
};
