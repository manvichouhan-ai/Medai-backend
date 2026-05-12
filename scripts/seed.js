import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { subDays, addDays, parseISO, startOfDay } from 'date-fns';
import { env } from '../config/env.js';
import User from '../models/User.model.js';
import Medication from '../models/Medication.model.js';
import MasterMedication from '../models/MasterMedication.model.js';
import PatientMedication from '../models/PatientMedication.model.js';
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

const MASTER_MEDICATIONS = [
  {
    name: 'Metformin',
    genericName: 'Metformin Hydrochloride',
    category: 'Antidiabetic',
    strength: '500mg',
    form: 'tablet',
    manufacturer: 'Pfizer',
    description: 'Used to control blood sugar levels in type 2 diabetes patients.',
    sideEffects: ['Nausea', 'diarrhea', 'stomach upset']
  },
  {
    name: 'Amoxicillin',
    genericName: 'Amoxicillin Trihydrate',
    category: 'Antibiotic',
    strength: '250mg',
    form: 'capsule',
    manufacturer: 'Cipla',
    description: 'Broad-spectrum antibiotic used for bacterial infections.',
    sideEffects: ['Rash', 'nausea', 'diarrhea']
  },
  {
    name: 'Paracetamol',
    genericName: 'Acetaminophen',
    category: 'Analgesic',
    strength: '650mg',
    form: 'tablet',
    manufacturer: 'Sun Pharma',
    description: 'Common pain reliever and fever reducer.',
    sideEffects: ['Liver toxicity', 'nausea']
  },
  {
    name: 'Atorvastatin',
    genericName: 'Atorvastatin Calcium',
    category: 'Cholesterol Control',
    strength: '20mg',
    form: 'tablet',
    manufacturer: 'Lupin',
    description: 'Helps reduce bad cholesterol and risk of heart disease.',
    sideEffects: ['Muscle pain', 'headache']
  },
  {
    name: 'Omeprazole',
    genericName: 'Omeprazole',
    category: 'Gastrointestinal',
    strength: '40mg',
    form: 'capsule',
    manufacturer: 'Dr. Reddy\'s',
    description: 'Reduces stomach acid and treats acid reflux.',
    sideEffects: ['Headache', 'abdominal pain']
  },
  {
    name: 'Cetirizine',
    genericName: 'Cetirizine Hydrochloride',
    category: 'Antihistamine',
    strength: '10mg',
    form: 'tablet',
    manufacturer: 'Zydus',
    description: 'Used for allergy relief and hay fever symptoms.',
    sideEffects: ['Drowsiness', 'dry mouth']
  },
  {
    name: 'Azithromycin',
    genericName: 'Azithromycin Dihydrate',
    category: 'Antibiotic',
    strength: '500mg',
    form: 'tablet',
    manufacturer: 'Aurobindo Pharma',
    description: 'Treats respiratory and skin bacterial infections.',
    sideEffects: ['Nausea', 'diarrhea', 'stomach pain']
  },
  {
    name: 'Losartan',
    genericName: 'Losartan Potassium',
    category: 'Hypertension',
    strength: '50mg',
    form: 'tablet',
    manufacturer: 'Torrent Pharma',
    description: 'Helps lower blood pressure and protect kidneys.',
    sideEffects: ['Dizziness', 'fatigue']
  },
  {
    name: 'Insulin Glargine',
    genericName: 'Insulin Glargine',
    category: 'Diabetes Care',
    strength: '100IU/ml',
    form: 'injection',
    manufacturer: 'Novo Nordisk',
    description: 'Long-acting insulin for blood sugar control.',
    sideEffects: ['Low blood sugar', 'injection site irritation']
  },
  {
    name: 'Salbutamol',
    genericName: 'Albuterol Sulfate',
    category: 'Respiratory',
    strength: '2mg',
    form: 'liquid',
    manufacturer: 'Glenmark',
    description: 'Relieves asthma and breathing difficulties.',
    sideEffects: ['Tremors', 'nervousness']
  },
  {
    name: 'Ibuprofen',
    genericName: 'Ibuprofen',
    category: 'Anti-inflammatory',
    strength: '400mg',
    form: 'tablet',
    manufacturer: 'Abbott',
    description: 'Reduces pain, inflammation, and fever.',
    sideEffects: ['Stomach irritation', 'dizziness']
  },
  {
    name: 'Levothyroxine',
    genericName: 'Levothyroxine Sodium',
    category: 'Thyroid',
    strength: '75mcg',
    form: 'tablet',
    manufacturer: 'Mankind Pharma',
    description: 'Used to treat hypothyroidism.',
    sideEffects: ['Weight loss', 'palpitations']
  },
  {
    name: 'Pantoprazole',
    genericName: 'Pantoprazole Sodium',
    category: 'Gastrointestinal',
    strength: '40mg',
    form: 'tablet',
    manufacturer: 'Alkem Labs',
    description: 'Treats acid reflux and stomach ulcers.',
    sideEffects: ['Headache', 'diarrhea']
  },
  {
    name: 'Dolo 650',
    genericName: 'Paracetamol',
    category: 'Fever & Pain Relief',
    strength: '650mg',
    form: 'tablet',
    manufacturer: 'Micro Labs',
    description: 'Popular fever and pain management medicine. Humans collectively decided this tablet is basically emotional support.',
    sideEffects: ['Nausea', 'allergic reactions']
  },
  {
    name: 'Montelukast',
    genericName: 'Montelukast Sodium',
    category: 'Allergy & Asthma',
    strength: '10mg',
    form: 'tablet',
    manufacturer: 'Cipla',
    description: 'Prevents asthma symptoms and allergic rhinitis.',
    sideEffects: ['Headache', 'stomach pain']
  },
  {
    name: 'Cefixime',
    genericName: 'Cefixime',
    category: 'Antibiotic',
    strength: '200mg',
    form: 'tablet',
    manufacturer: 'Macleods',
    description: 'Used for bacterial infections in lungs and urinary tract.',
    sideEffects: ['Diarrhea', 'nausea']
  },
  {
    name: 'Vitamin D3',
    genericName: 'Cholecalciferol',
    category: 'Supplements',
    strength: '60000IU',
    form: 'capsule',
    manufacturer: 'HealthKart',
    description: 'Supports bone health and calcium absorption.',
    sideEffects: ['Constipation', 'weakness']
  },
  {
    name: 'Aspirin',
    genericName: 'Acetylsalicylic Acid',
    category: 'Blood Thinner',
    strength: '75mg',
    form: 'tablet',
    manufacturer: 'Bayer',
    description: 'Prevents blood clots and reduces heart attack risk.',
    sideEffects: ['Bleeding', 'stomach irritation']
  }
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

async function seedMedications(rajan, doctor) {
  const startDate = subDays(new Date(), 30);
  const meds = [];
  const patientMeds = [];

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

    // Find corresponding master medication
    const masterMed = await MasterMedication.findOne({ name: m.name });
    if (masterMed) {
      await PatientMedication.deleteMany({ patientId: rajan._id, medicationId: masterMed._id });
      const patientMed = await PatientMedication.create({
        patientId: rajan._id,
        medicationId: masterMed._id,
        assignedByDoctor: doctor._id,
        dosage: m.dosage,
        scheduleType: 'daily',
        times: m.times,
        daysOfWeek: [],
        startDate,
        isActive: true,
      });
      patientMeds.push(patientMed);
      console.log(`Created patient medication: ${m.name}`);
    }
  }
  return { meds, patientMeds };
}

async function seedDoseLogs(rajan, { patientMeds }) {
  const startDate = subDays(new Date(), 30);
  await DoseLog.deleteMany({ patientId: rajan._id });

  const allLogs = [];
  for (const patientMed of patientMeds) {
    // Get the master medication to find the name
    const masterMed = await MasterMedication.findById(patientMed.medicationId);
    if (!masterMed) continue;
    
    const med = MEDICATIONS.find((m) => m.name === masterMed.name);
    if (!med) continue;
    
    for (let i = 0; i < 30; i++) {
      const day = addDays(startOfDay(startDate), i);
      for (const timeStr of med.times) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const scheduledTime = new Date(day);
        scheduledTime.setUTCHours(hours, minutes, 0, 0);
        allLogs.push({ 
          patientMedicationId: patientMed._id, 
          medicationId: patientMed.medicationId, 
          patientId: rajan._id, 
          scheduledTime 
        });
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

async function seedCaregiverLink(priya, rajan, doctor) {
  await CaregiverPatient.deleteOne({ caregiverId: priya._id, patientId: rajan._id });
  const link = await CaregiverPatient.create({
    caregiverId: priya._id,
    patientId: rajan._id,
    doctorId: doctor._id,
    relationship: 'family',
    status: 'active',
    alertPreferences: { push: true, sms: true, email: false, thresholdMinutes: 30 },
  });
  console.log(`Linked caregiver ${priya.email} → patient ${rajan.email}`);
  return link;
}

async function seedMasterMedications(doctor) {
  for (const med of MASTER_MEDICATIONS) {
    await MasterMedication.deleteOne({ name: med.name });
    await MasterMedication.create({
      ...med,
      createdByDoctor: doctor._id,
    });
    console.log(`Created master medication: ${med.name}`);
  }
}

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const users = await seedUsers();
  const rajan = users['rajan@demo.com'];
  const priya = users['priya@demo.com'];
  const doctor = users['doctor@demo.com'];

  await seedMasterMedications(doctor);
  const medData = await seedMedications(rajan, doctor);
  await seedDoseLogs(rajan, medData);
  await seedCaregiverLink(priya, rajan, doctor);

  console.log('\nSeed complete!');
  console.log('Demo credentials:');
  DEMO_USERS.forEach((u) => console.log(`  ${u.role}: ${u.email} / ${u.password}`));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
