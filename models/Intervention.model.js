import mongoose from 'mongoose';

const interventionSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    interventionType: {
      type: String,
      enum: [
        'medication_non_adherence',
        'repeated_disputes',
        'high_risk_prediction',
        'emergency',
        'medication_adjustment',
        'caregiver_request',
      ],
      required: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'resolved', 'escalated', 'cancelled'],
      default: 'pending',
      index: true,
    },
    reason: { type: String, required: true },
    notes: { type: String },
    relatedAlertIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Alert' }],
    relatedDoseLogIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DoseLog' }],
    resolvedAt: { type: Date },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    escalationLevel: {
      type: Number,
      default: 0,
      min: 0,
    },
    followUpRequired: {
      type: Boolean,
      default: false,
    },
    followUpDate: { type: Date },
  },
  { timestamps: true }
);

interventionSchema.index({ patientId: 1, status: 1 });
interventionSchema.index({ assignedTo: 1, status: 1 });
interventionSchema.index({ priority: -1, createdAt: -1 });
interventionSchema.index({ createdBy: 1, createdAt: -1 });

export default mongoose.model('Intervention', interventionSchema);
