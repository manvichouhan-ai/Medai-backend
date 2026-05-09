import mongoose from 'mongoose';

const medicationDataSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: {
      times: { type: [String], default: [] },
      days: { type: [String], default: ['all'] },
    },
    instructions: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
  },
  { _id: false }
);

const medicationRequestSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requestedByRole: {
      type: String,
      enum: ['patient', 'caregiver'],
      required: true,
    },
    type: {
      type: String,
      enum: ['new_medication', 'dosage_change', 'discontinue'],
      required: true,
    },
    medicationData: {
      type: medicationDataSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },
    notes: { type: String },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
  },
  { timestamps: true }
);

medicationRequestSchema.index({ patientId: 1, status: 1, createdAt: -1 });
medicationRequestSchema.index({ requestedBy: 1, status: 1 });
medicationRequestSchema.index({ status: 1, priority: 1, createdAt: 1 });

export default mongoose.model('MedicationRequest', medicationRequestSchema);
