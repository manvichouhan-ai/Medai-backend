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
  },
  { timestamps: true }
);

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

export default mongoose.model('User', userSchema);
