import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MasterMedication from '../models/MasterMedication.model.js';
import PatientMedication from '../models/PatientMedication.model.js';
import Medication from '../models/Medication.model.js';
import DoseLog from '../models/DoseLog.model.js';
import { logger } from '../src/utils/logger.js';

dotenv.config();

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medai');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

async function migrateMedications() {
  console.log('Starting medication migration...');
  
  try {
    // Step 1: Get all existing medications from old model
    const oldMedications = await Medication.find({}).lean();
    console.log(`Found ${oldMedications.length} medications to migrate`);

    // Step 2: Create unique master medications
    const uniqueMedications = new Map();
    
    for (const med of oldMedications) {
      const key = `${med.name.toLowerCase().trim()}-${med.dosage?.toLowerCase().trim() || ''}`;
      
      if (!uniqueMedications.has(key)) {
        uniqueMedications.set(key, {
          name: med.name,
          genericName: med.name, // Use name as generic name for now
          category: 'General', // Default category
          strength: med.dosage || 'Unknown',
          form: 'tablet', // Default form
          manufacturer: 'Unknown', // Default manufacturer
          description: med.instructions || '',
          sideEffects: [],
          createdByDoctor: med.createdByDoctor || med.prescribedBy,
          isActive: med.isActive,
        });
      }
    }

    console.log(`Created ${uniqueMedications.size} unique master medications`);

    // Step 3: Insert master medications
    const masterMedArray = Array.from(uniqueMedications.values());
    const insertedMasterMeds = await MasterMedication.insertMany(masterMedArray);
    console.log(`Inserted ${insertedMasterMeds.length} master medications`);

    // Create lookup map for old medication to master medication mapping
    const medNameToMasterId = new Map();
    for (const masterMed of insertedMasterMeds) {
      const key = `${masterMed.name.toLowerCase().trim()}-${masterMed.strength?.toLowerCase().trim() || ''}`;
      medNameToMasterId.set(key, masterMed._id);
    }

    // Step 4: Create patient medication assignments
    const patientMedications = [];
    
    for (const oldMed of oldMedications) {
      const key = `${oldMed.name.toLowerCase().trim()}-${oldMed.dosage?.toLowerCase().trim() || ''}`;
      const masterMedId = medNameToMasterId.get(key);
      
      if (masterMedId) {
        patientMedications.push({
          patientId: oldMed.patientId,
          medicationId: masterMedId,
          assignedByDoctor: oldMed.createdByDoctor || oldMed.prescribedBy,
          dosage: oldMed.dosage || '1 tablet',
          scheduleType: oldMed.scheduleType || 'daily',
          times: oldMed.frequency?.times || ['09:00'],
          daysOfWeek: oldMed.daysOfWeek || [],
          instructions: oldMed.instructions,
          startDate: oldMed.startDate || new Date(),
          endDate: oldMed.endDate,
          isActive: oldMed.isActive,
          createdAt: oldMed.createdAt,
          updatedAt: oldMed.updatedAt,
        });
      }
    }

    if (patientMedications.length > 0) {
      const insertedPatientMeds = await PatientMedication.insertMany(patientMedications);
      console.log(`Created ${insertedPatientMeds.length} patient medication assignments`);

      // Step 5: Update dose logs to reference new models
      const oldMedIdToPatientMedId = new Map();
      
      for (const oldMed of oldMedications) {
        const key = `${oldMed.name.toLowerCase().trim()}-${oldMed.dosage?.toLowerCase().trim() || ''}`;
        const masterMedId = medNameToMasterId.get(key);
        
        // Find the corresponding patient medication
        const patientMed = insertedPatientMeds.find(pm => 
          pm.patientId.toString() === oldMed.patientId.toString() &&
          pm.medicationId.toString() === masterMedId.toString()
        );
        
        if (patientMed) {
          oldMedIdToPatientMedId.set(oldMed._id.toString(), patientMed._id);
        }
      }

      // Update existing dose logs
      const doseLogs = await DoseLog.find({}).lean();
      const updates = [];
      
      for (const doseLog of doseLogs) {
        const patientMedId = oldMedIdToPatientMedId.get(doseLog.medicationId.toString());
        const oldMed = oldMedications.find(m => m._id.toString() === doseLog.medicationId.toString());
        
        if (patientMedId && oldMed) {
          const masterMedKey = `${oldMed.name.toLowerCase().trim()}-${oldMed.dosage?.toLowerCase().trim() || ''}`;
          const masterMedId = medNameToMasterId.get(masterMedKey);
          
          updates.push({
            updateOne: {
              filter: { _id: doseLog._id },
              update: {
                $set: {
                  patientMedicationId: patientMedId,
                  medicationId: masterMedId,
                }
              }
            }
          });
        }
      }

      if (updates.length > 0) {
        await DoseLog.bulkWrite(updates);
        console.log(`Updated ${updates.length} dose logs`);
      }
    }

    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

async function rollbackMigration() {
  console.log('Starting rollback...');
  
  try {
    // Delete patient medications
    await PatientMedication.deleteMany({});
    console.log('Deleted all patient medications');
    
    // Delete master medications
    await MasterMedication.deleteMany({});
    console.log('Deleted all master medications');
    
    // Restore dose logs (remove new fields)
    await DoseLog.updateMany(
      {},
      { 
        $unset: { patientMedicationId: 1 },
        $rename: { medicationId: 'oldMedicationId' }
      }
    );
    await DoseLog.updateMany(
      {},
      { $rename: { oldMedicationId: 'medicationId' } }
    );
    console.log('Restored dose logs');
    
    console.log('Rollback completed!');
    
  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  }
}

async function main() {
  const command = process.argv[2];
  
  await connectToDatabase();
  
  try {
    if (command === 'migrate') {
      await migrateMedications();
    } else if (command === 'rollback') {
      await rollbackMigration();
    } else {
      console.log('Usage: node migrate-medication-data.js [migrate|rollback]');
    }
  } catch (error) {
    console.error('Operation failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main();
