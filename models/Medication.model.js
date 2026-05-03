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
    name: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: { type: frequencySchema, default: () => ({}) },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    instructions: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Medication', medicationSchema);
