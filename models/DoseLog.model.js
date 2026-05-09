import mongoose from 'mongoose';

const doseLogSchema = new mongoose.Schema(
  {
    medicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medication',
      required: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    scheduledTime: { type: Date, required: true, index: true },
    takenAt: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'taken', 'missed', 'delayed'],
      default: 'pending',
    },
    delayMinutes: { type: Number, default: 0 },
    notes: { type: String },
    takenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    takenByRole: {
      type: String,
      enum: ['patient', 'caregiver'],
    },
    assistedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    confirmedAt: { type: Date },
    confirmationStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'disputed'],
      default: 'pending',
      index: true,
    },
    assistanceNotes: { type: String },
    interventionRequired: {
      type: Boolean,
      default: false,
      index: true,
    },
    interventionReason: { type: String },
  },
  { timestamps: true }
);

doseLogSchema.index({ patientId: 1, scheduledTime: -1 });
doseLogSchema.index({ patientId: 1, status: 1 });
doseLogSchema.index({ patientId: 1, scheduledTime: -1, status: 1 });

export default mongoose.model('DoseLog', doseLogSchema);
