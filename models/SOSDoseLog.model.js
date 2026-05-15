import mongoose from 'mongoose';

const sosDoseLogSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sosMedication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SOSMedication',
      required: true,
      index: true,
    },
    takenAt: { type: Date, default: Date.now },
    reason: { type: String },
    painLevel: { type: Number, min: 1, max: 10 },
    photoUrl: { type: String },
    verified: { type: Boolean, default: false },
    notifiedDoctor: { type: Boolean, default: false },
    notifiedCaregiver: { type: Boolean, default: false },
    location: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

sosDoseLogSchema.index({ patient: 1, sosMedication: 1 });
sosDoseLogSchema.index({ patient: 1, takenAt: -1 });

export default mongoose.model('SOSDoseLog', sosDoseLogSchema);
