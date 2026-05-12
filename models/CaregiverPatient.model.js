import mongoose from 'mongoose';

const alertPreferencesSchema = new mongoose.Schema(
  {
    push: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    thresholdMinutes: { type: Number, default: 30 },
  },
  { _id: false }
);

const caregiverPatientSchema = new mongoose.Schema(
  {
    caregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    relationship: { type: String },
    assignedAt: { type: Date, default: Date.now },
    canEditSchedule: { type: Boolean, default: false },
    alertPreferences: { type: alertPreferencesSchema, default: () => ({}) },
    status: { type: String, enum: ['pending', 'active'], default: 'pending' },
  },
  { timestamps: true }
);

caregiverPatientSchema.index({ caregiverId: 1, patientId: 1 }, { unique: true });
caregiverPatientSchema.index({ caregiverId: 1, status: 1 });
caregiverPatientSchema.index({ doctorId: 1, status: 1 });

export default mongoose.model('CaregiverPatient', caregiverPatientSchema);
