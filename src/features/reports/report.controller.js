import * as reportService from './report.service.js';
import { sendSuccess } from '../../utils/response.utils.js';

export async function getReport(req, res, next) {
  try {
    const report = await reportService.buildReport(req.params.id, req.query);
    return sendSuccess(res, report);
  } catch (err) {
    next(err);
  }
}

export async function exportReport(req, res, next) {
  try {
    const report = await reportService.buildReport(req.params.id, req.query);
    await reportService.generatePDF(report, res);
  } catch (err) {
    next(err);
  }
}
