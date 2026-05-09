import mongoose from 'mongoose';

const doctorPatientSchema = new mongoose.Schema(
  {
    doctorId: {
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
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    notes: { type: String },
  },
  { timestamps: true }
);

doctorPatientSchema.index({ doctorId: 1, patientId: 1 }, { unique: true });
doctorPatientSchema.index({ patientId: 1, status: 1 });

export default mongoose.model('DoctorPatient', doctorPatientSchema);