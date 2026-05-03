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
      enum: ['missed_dose', 'high_risk', 'delay', 'anomaly'],
      required: true,
    },
    message: { type: String, required: true },
    sentTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    channels: [{ type: String }],
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('Alert', alertSchema);
