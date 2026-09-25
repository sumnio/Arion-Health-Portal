import mongoose from 'mongoose';
import { modelOptions } from './modelOptions.js';

const doctorBlockedTimeSchema = new mongoose.Schema(
  {
    doctor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    start_at: { type: Date, required: true },
    end_at: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return !this.start_at || !value || value > this.start_at;
        },
        message: 'end_at must be later than start_at',
      },
    },
    reason: { type: String, required: true, trim: true },
  },
  modelOptions,
);

doctorBlockedTimeSchema.index(
  { doctor_id: 1, start_at: 1, end_at: 1 },
  { name: 'doctor_blocked_time_lookup' },
);

export const DoctorBlockedTime =
  mongoose.models.DoctorBlockedTime ??
  mongoose.model('DoctorBlockedTime', doctorBlockedTimeSchema, 'doctor_blocked_times');
