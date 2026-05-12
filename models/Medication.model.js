import mongoose from 'mongoose';

const frequencySchema = new mongoose.Schema(
  {
    times: { type: [String], default: [] },
    days: { type: [String], default: ['all'] },
  },
  { _id: false }
);

const medicationSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    prescribedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    name: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: { type: frequencySchema, default: () => ({}) },
    scheduleType: { type: String, enum: ['daily', 'weekly'], default: 'daily' },
    daysOfWeek: { type: [String], default: [] },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    instructions: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

medicationSchema.index({ patientId: 1, isActive: 1 });
medicationSchema.index({ patientId: 1, createdAt: -1 });
medicationSchema.index({ createdByDoctor: 1, isActive: 1 });

export default mongoose.model('Medication', medicationSchema);
