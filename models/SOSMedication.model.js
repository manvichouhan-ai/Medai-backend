import mongoose from 'mongoose';

const sosMedicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    dosage: { type: String },
    unit: { type: String },
    importance: {
      type: String,
      enum: ['critical', 'important'],
      default: 'critical',
    },
    category: { type: String },
    sideEffects: { type: String },
    instructions: { type: String },
    maxDosesPerDay: { type: Number, default: 1, min: 1 },
    cooldownMinutes: { type: Number, default: 360, min: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assignedPatients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

sosMedicationSchema.index({ createdBy: 1, isActive: 1 });
sosMedicationSchema.index({ assignedPatients: 1, isActive: 1 });

export default mongoose.model('SOSMedication', sosMedicationSchema);
