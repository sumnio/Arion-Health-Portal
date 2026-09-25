export const modelOptions = {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  versionKey: false,
};

export const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isOrderedTimeRange(startTime, endTime) {
  return !startTime || !endTime || startTime < endTime;
}
