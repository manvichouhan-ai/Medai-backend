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
  },
  { timestamps: true }
);

export default mongoose.model('DoseLog', doseLogSchema);
