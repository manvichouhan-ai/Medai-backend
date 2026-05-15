import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    triggeredBy: {
      type: String,
      enum: ['system', 'ai_prediction', 'manual'],
      required: true,
    },
    type: {
      type: String,
      enum: ['missed_dose', 'high_risk', 'delay', 'anomaly', 'sos_taken'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
    message: { type: String, required: true },
    sentTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    channels: [{ type: String }],
    isRead: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['active', 'acknowledged', 'resolved', 'escalated'],
      default: 'active',
      index: true,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: { type: Date },
    escalationLevel: {
      type: Number,
      default: 0,
      min: 0,
    },
    escalatedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    relatedInterventionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Intervention',
    },
    resolutionNotes: { type: String },
  },
  { timestamps: true }
);

alertSchema.index({ patientId: 1, status: 1 });
alertSchema.index({ patientId: 1, status: 1, severity: 1 });
alertSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Alert', alertSchema);
