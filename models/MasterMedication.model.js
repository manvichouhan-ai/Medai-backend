import mongoose from 'mongoose';

const masterMedicationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    genericName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    strength: {
      type: String,
      required: true,
      trim: true,
    },
    form: {
      type: String,
      required: true,
      enum: [
        'tablet',
        'capsule',
        'liquid',
        'injection',
        'inhaler',
        'patch',
        'cream',
        'ointment',
        'drops',
        'spray',
      ],
    },
    importance: {
      type: String,
      enum: ['critical', 'important', 'routine'],
      default: 'routine',
      index: true,
    },
    manufacturer: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    sideEffects: [
      {
        type: String,
        trim: true,
      },
    ],
    createdByDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound indexes for performance
masterMedicationSchema.index({ name: 1, isActive: 1 });
masterMedicationSchema.index({ category: 1, isActive: 1 });
masterMedicationSchema.index({ importance: 1, isActive: 1 });
masterMedicationSchema.index({ createdByDoctor: 1, importance: 1, isActive: 1 });
masterMedicationSchema.index({ genericName: 1, isActive: 1 });

// Text search index
masterMedicationSchema.index({
  name: 'text',
  genericName: 'text',
  manufacturer: 'text',
});

export default mongoose.model('MasterMedication', masterMedicationSchema);
