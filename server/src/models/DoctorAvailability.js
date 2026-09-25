import mongoose from 'mongoose';
import { isOrderedTimeRange, modelOptions, timePattern } from './modelOptions.js';

const doctorAvailabilitySchema = new mongoose.Schema(
  {
    doctor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    day_of_week: { type: Number, required: true, min: 0, max: 6 },
    start_time: { type: String, required: true, match: timePattern },
    end_time: {
      type: String,
      required: true,
      match: timePattern,
      validate: {
        validator(value) {
          return isOrderedTimeRange(this.start_time, value);
        },
        message: 'end_time must be later than start_time',
      },
    },
    is_active: { type: Boolean, default: true },
  },
  modelOptions,
);

doctorAvailabilitySchema.index(
  { doctor_id: 1, day_of_week: 1, start_time: 1 },
  { name: 'doctor_weekly_availability_lookup' },
);

export const DoctorAvailability =
  mongoose.models.DoctorAvailability ??
  mongoose.model(
    'DoctorAvailability',
    doctorAvailabilitySchema,
    'doctor_availability',
  );
