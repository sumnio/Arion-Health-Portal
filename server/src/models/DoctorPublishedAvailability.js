import mongoose from 'mongoose';
import { isOrderedTimeRange, modelOptions, timePattern } from './modelOptions.js';

const doctorPublishedAvailabilitySchema = new mongoose.Schema(
  {
    doctor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    availability_date: { type: Date, required: true },
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
  },
  modelOptions,
);

doctorPublishedAvailabilitySchema.index(
  { doctor_id: 1, availability_date: 1, start_time: 1 },
  { name: 'doctor_published_availability_lookup' },
);

export const DoctorPublishedAvailability =
  mongoose.models.DoctorPublishedAvailability ??
  mongoose.model(
    'DoctorPublishedAvailability',
    doctorPublishedAvailabilitySchema,
    'doctor_published_availability',
  );
