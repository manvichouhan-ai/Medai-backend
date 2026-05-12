export function sendSuccess(res, data, statusCode = 200) {
  const processedData = normalizeIds(data);
  return res.status(statusCode).json({ success: true, data: processedData });
}

export function sendError(res, message, statusCode = 400) {
  return res.status(statusCode).json({ success: false, error: message });
}

/**
 * Recursively converts MongoDB _id to id in objects and arrays
 * This ensures frontend always receives 'id' field instead of '_id'
 */
function normalizeIds(data, visited = new WeakSet()) {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map((item) => normalizeIds(item, visited));
  }

  if (typeof data === 'object' && data !== null) {
    // Handle circular references
    if (visited.has(data)) {
      return data;
    }
    visited.add(data);

    const normalized = { ...data };

    // Convert _id to id
    if (normalized._id) {
      normalized.id = normalized._id.toString();
      delete normalized._id;
    }

    // Convert nested _id fields
    for (const key in normalized) {
      if (normalized[key] != null && typeof normalized[key] === 'object' &&
          (normalized[key]._bsontype !== undefined || normalized[key].buffer instanceof Buffer)) {
        normalized[key] = normalized[key].toString();
        continue;
      }
      if (normalized[key] instanceof Date) {
        normalized[key] = normalized[key].toISOString();
        continue;
      }
      if (normalized[key] && typeof normalized[key] === 'object') {
        normalized[key] = normalizeIds(normalized[key], visited);
      }
    }

    return normalized;
  }

  return data;
}
