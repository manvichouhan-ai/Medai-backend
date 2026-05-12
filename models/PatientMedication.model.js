import mongoose from 'mongoose';

const patientMedicationSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    medicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MasterMedication',
      required: true,
      index: true,
    },
    assignedByDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    dosage: {
      type: String,
      required: true,
      trim: true,
    },
    scheduleType: {
      type: String,
      required: true,
      enum: ['daily', 'weekly'],
      default: 'daily',
    },
    times: [{
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Time must be in HH:mm format (24-hour)'
      }
    }],
    daysOfWeek: [{
      type: String,
      enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    }],
    instructions: {
      type: String,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      validate: {
        validator: function(v) {
          return !v || v >= this.startDate;
        },
        message: 'End date must be after or equal to start date'
      }
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
patientMedicationSchema.index({ patientId: 1, isActive: 1 });
patientMedicationSchema.index({ medicationId: 1, isActive: 1 });
patientMedicationSchema.index({ assignedByDoctor: 1, isActive: 1 });
patientMedicationSchema.index({ patientId: 1, startDate: -1 });
patientMedicationSchema.index({ patientId: 1, medicationId: 1 }, { unique: true, sparse: true });

// Validation for times array
patientMedicationSchema.pre('save', function(next) {
  if (this.times && this.times.length > 0) {
    // Check for duplicate times
    const uniqueTimes = [...new Set(this.times)];
    if (uniqueTimes.length !== this.times.length) {
      return next(new Error('Duplicate times are not allowed'));
    }
  }
  
  // Validate schedule requirements
  if (this.scheduleType === 'weekly' && (!this.daysOfWeek || this.daysOfWeek.length === 0)) {
    return next(new Error('Days of week are required for weekly schedule'));
  }
  
  if (this.scheduleType === 'daily' && (!this.times || this.times.length === 0)) {
    return next(new Error('Times are required for daily schedule'));
  }
  
  next();
});

export default mongoose.model('PatientMedication', patientMedicationSchema);
