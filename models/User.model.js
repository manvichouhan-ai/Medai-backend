import mongoose from 'mongoose';

const notificationPrefsSchema = new mongoose.Schema(
  {
    push: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    email: { type: Boolean, default: true },
    reminderLeadMinutes: { type: Number, default: 15 },
  },
  { _id: false }
);

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String },
    phone: { type: String },
    relationship: { type: String },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, select: false },
    role: {
      type: String,
      enum: ['patient', 'caregiver', 'doctor', 'admin'],
      default: 'patient',
    },
    fullName: { type: String, required: true },
    phone: { type: String },
    timezone: { type: String, default: 'UTC' },
    isActive: { type: Boolean, default: true },
    googleId: { type: String },
    fcmToken: { type: String },
    notificationPrefs: { type: notificationPrefsSchema, default: () => ({}) },
    address: { type: String },
    relationship: { type: String },
    // Patient-specific fields
    age: { type: Number },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    conditions: { type: [String], default: [] },
    emergencyContact: { type: emergencyContactSchema },
    createdByDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: true }
);

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

export default mongoose.model('User', userSchema);
