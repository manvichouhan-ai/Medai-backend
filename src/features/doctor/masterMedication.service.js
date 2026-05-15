import MasterMedication from '../../../models/MasterMedication.model.js';
import { logger } from '../../utils/logger.js';

export async function createMasterMedication(doctorId, data) {
  try {
    const medication = await MasterMedication.create({
      ...data,
      createdByDoctor: doctorId,
    });

    logger.info('Master medication created', {
      medicationId: medication._id,
      doctorId,
      name: medication.name,
    });

    return medication;
  } catch (error) {
    logger.error('Failed to create master medication', {
      error: error.message,
      doctorId,
    });
    throw error;
  }
}

export async function getMasterMedications(doctorId, filters = {}) {
  try {
    const {
      search,
      category,
      importance,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const query = { isActive: true };

    // If not admin, only show medications created by this doctor
    if (doctorId) {
      query.createdByDoctor = doctorId;
    }

    // Search functionality
    if (search) {
      query.$text = { $search: search };
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    if (importance) {
      query.importance = importance;
    }

    const skip = (page - 1) * limit;

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [medications, total] = await Promise.all([
      MasterMedication.find(query)
        .populate('createdByDoctor', 'fullName email')
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      MasterMedication.countDocuments(query),
    ]);

    return {
      medications,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Failed to get master medications', {
      error: error.message,
      doctorId,
    });
    throw error;
  }
}

export async function getMasterMedicationById(medicationId, doctorId) {
  try {
    const query = { _id: medicationId, isActive: true };

    // If not admin, only allow access to own medications
    if (doctorId) {
      query.createdByDoctor = doctorId;
    }

    const medication = await MasterMedication.findOne(query)
      .populate('createdByDoctor', 'fullName email')
      .lean();

    if (!medication) {
      throw Object.assign(new Error('Medication not found'), { statusCode: 404 });
    }

    return medication;
  } catch (error) {
    logger.error('Failed to get master medication by ID', {
      error: error.message,
      medicationId,
      doctorId,
    });
    throw error;
  }
}

/**
 * Calculates weighted adherence score.
 * @param {Array<{ taken: boolean, importance: string }>} doses
 * @returns {{ score: number, totalWeight: number, takenWeight: number }}
 */
export function calculateWeightedAdherenceScore(doses) {
  let totalWeight = 0;
  let takenWeight = 0;

  for (const dose of doses) {
    const weight = getImportanceWeight(dose.importance);
    totalWeight += weight;
    if (dose.taken) {
      takenWeight += weight;
    }
  }

  const score = totalWeight > 0 ? Math.round((takenWeight / totalWeight) * 100) : 100;

  return { score, totalWeight, takenWeight };
}

export async function updateMasterMedication(medicationId, doctorId, updates) {
  try {
    const query = { _id: medicationId, isActive: true };

    // If not admin, only allow updates to own medications
    if (doctorId) {
      query.createdByDoctor = doctorId;
    }

    const medication = await MasterMedication.findOne(query);
    if (!medication) {
      throw Object.assign(new Error('Medication not found or access denied'), { statusCode: 404 });
    }

    const updated = await MasterMedication.findByIdAndUpdate(medicationId, updates, {
      new: true,
      runValidators: true,
    }).populate('createdByDoctor', 'fullName email');

    logger.info('Master medication updated', {
      medicationId,
      doctorId,
      updates: Object.keys(updates),
    });

    return updated;
  } catch (error) {
    logger.error('Failed to update master medication', {
      error: error.message,
      medicationId,
      doctorId,
    });
    throw error;
  }
}

export async function deleteMasterMedication(medicationId, doctorId) {
  try {
    const query = { _id: medicationId, isActive: true };

    // If not admin, only allow deletion of own medications
    if (doctorId) {
      query.createdByDoctor = doctorId;
    }

    const medication = await MasterMedication.findOne(query);
    if (!medication) {
      throw Object.assign(new Error('Medication not found or access denied'), { statusCode: 404 });
    }

    // Soft delete
    medication.isActive = false;
    await medication.save();

    logger.info('Master medication deleted', {
      medicationId,
      doctorId,
      name: medication.name,
    });

    return medication;
  } catch (error) {
    logger.error('Failed to delete master medication', {
      error: error.message,
      medicationId,
      doctorId,
    });
    throw error;
  }
}

export async function getMedicationCategories(doctorId) {
  try {
    const matchStage = { isActive: true };
    if (doctorId) {
      matchStage.createdByDoctor = doctorId;
    }

    const categories = await MasterMedication.aggregate([
      { $match: matchStage },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    return categories.map((cat) => ({
      category: cat._id,
      count: cat.count,
    }));
  } catch (error) {
    logger.error('Failed to get medication categories', {
      error: error.message,
      doctorId,
    });
    throw error;
  }
}
