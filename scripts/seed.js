import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { subDays, addDays, parseISO, startOfDay } from 'date-fns';
import { env } from '../config/env.js';
import User from '../models/User.model.js';
import Medication from '../models/Medication.model.js';
import DoseLog from '../models/DoseLog.model.js';
import CaregiverPatient from '../models/CaregiverPatient.model.js';

const BCRYPT_ROUNDS = 12;
const DEMO_USERS = [
  { email: 'rajan@demo.com', password: 'demo1234', role: 'patient', fullName: 'Rajan Kumar', timezone: 'Asia/Kolkata' },
  { email: 'priya@demo.com', password: 'demo1234', role: 'caregiver', fullName: 'Priya Kumar' },
  { email: 'doctor@demo.com', password: 'demo1234', role: 'doctor', fullName: 'Dr. Sharma' },
];

const MEDICATIONS = [
  { name: 'Metformin', dosage: '500mg', times: ['08:00', '20:00'], days: ['all'] },
  { name: 'Amlodipine', dosage: '5mg', times: ['10:00'], days: ['all'] },
  { name: 'Atorvastatin', dosage: '10mg', times: ['21:00'], days: ['all'] },
  { name: 'Vitamin D3', dosage: '1000IU', times: ['09:00'], days: ['all'] },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

async function seedUsers() {
  const users = {};
  for (const u of DEMO_USERS) {
    await User.deleteOne({ email: u.email });
    const passwordHash = await bcrypt.hash(u.password, BCRYPT_ROUNDS);
    const user = await User.create({ ...u, passwordHash });
    users[u.email] = user;
    console.log(`Created user: ${u.email}`);
  }
  return users;
}

function buildDoseLogs(medicationId, patientId, startDate, days = 30) {
  const logs = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(startOfDay(startDate), i);
    const dayName = DAY_NAMES[day.getDay()];

    for (const med of MEDICATIONS) {
      for (const timeStr of med.times) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const scheduledTime = new Date(day);
        scheduledTime.setUTCHours(hours, minutes, 0, 0);
        logs.push({ scheduledTime, medicationId, patientId });
      }
    }
  }
  return logs;
}

async function seedMedications(rajan) {
  const startDate = subDays(new Date(), 30);
  const meds = [];

  for (const m of MEDICATIONS) {
    await Medication.deleteMany({ patientId: rajan._id, name: m.name });
    const med = await Medication.create({
      patientId: rajan._id,
      name: m.name,
      dosage: m.dosage,
      frequency: { times: m.times, days: m.days },
      startDate,
      isActive: true,
    });
    meds.push(med);
    console.log(`Created medication: ${m.name}`);
  }
  return meds;
}

async function seedDoseLogs(rajan, meds) {
  const startDate = subDays(new Date(), 30);
  await DoseLog.deleteMany({ patientId: rajan._id });

  const allLogs = [];
  for (const med of meds) {
    for (let i = 0; i < 30; i++) {
      const day = addDays(startOfDay(startDate), i);
      for (const timeStr of MEDICATIONS.find((m) => m.name === med.name)?.times || []) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const scheduledTime = new Date(day);
        scheduledTime.setUTCHours(hours, minutes, 0, 0);
        allLogs.push({ medicationId: med._id, patientId: rajan._id, scheduledTime });
      }
    }
  }

  const docs = allLogs.map((entry) => {
    const isTaken = Math.random() < 0.85;
    if (isTaken) {
      const delayMinutes = Math.floor(Math.random() * 20);
      const takenAt = new Date(entry.scheduledTime.getTime() + delayMinutes * 60 * 1000);
      return {
        ...entry,
        status: delayMinutes > 30 ? 'delayed' : 'taken',
        takenAt,
        delayMinutes,
      };
    }
    return { ...entry, status: 'missed' };
  });

  await DoseLog.insertMany(docs);
  const taken = docs.filter((d) => d.status === 'taken' || d.status === 'delayed').length;
  console.log(`Seeded ${docs.length} dose logs (${taken} taken, ${docs.length - taken} missed)`);
}

async function seedCaregiverLink(priya, rajan) {
  await CaregiverPatient.deleteOne({ caregiverId: priya._id, patientId: rajan._id });
  const link = await CaregiverPatient.create({
    caregiverId: priya._id,
    patientId: rajan._id,
    relationship: 'family',
    status: 'active',
    alertPreferences: { push: true, sms: true, email: false, thresholdMinutes: 30 },
  });
  console.log(`Linked caregiver ${priya.email} → patient ${rajan.email}`);
  return link;
}

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const users = await seedUsers();
  const rajan = users['rajan@demo.com'];
  const priya = users['priya@demo.com'];

  const meds = await seedMedications(rajan);
  await seedDoseLogs(rajan, meds);
  await seedCaregiverLink(priya, rajan);

  console.log('\nSeed complete!');
  console.log('Demo credentials:');
  DEMO_USERS.forEach((u) => console.log(`  ${u.role}: ${u.email} / ${u.password}`));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
