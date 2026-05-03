import User from '../../models/User.model.js';

export async function getMe(userId) {
  const user = await User.findById(userId).select('-passwordHash');
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return user;
}

export async function updateMe(userId, updates) {
  const allowed = ['fullName', 'phone', 'timezone', 'notificationPrefs', 'fcmToken'];
  const filtered = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  );
  const user = await User.findByIdAndUpdate(userId, filtered, { new: true, runValidators: true }).select('-passwordHash');
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return user;
}
