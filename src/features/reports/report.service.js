import PDFDocument from 'pdfkit';
import { subDays, format } from 'date-fns';
import User from '../../../models/User.model.js';
import Medication from '../../../models/Medication.model.js';
import DoseLog from '../../../models/DoseLog.model.js';
import { computeAdherenceRate } from '../../utils/adherence.utils.js';

export async function buildReport(patientId, { from, to }) {
  const start = from ? new Date(from) : subDays(new Date(), 30);
  const end = to ? new Date(to) : new Date();

  const patient = await User.findById(patientId).select('-passwordHash').lean();
  if (!patient) throw Object.assign(new Error('Patient not found'), { statusCode: 404 });

  const medications = await Medication.find({ patientId, isActive: true }).lean();

  const medsWithStats = await Promise.all(
    medications.map(async (med) => {
      const logs = await DoseLog.find({
        medicationId: med._id,
        scheduledTime: { $gte: start, $lte: end },
      }).lean();

      return {
        medication: med,
        logs,
        adherence: computeAdherenceRate(logs),
        taken: logs.filter((l) => l.status === 'taken').length,
        missed: logs.filter((l) => l.status === 'missed').length,
        delayed: logs.filter((l) => l.status === 'delayed').length,
        total: logs.length,
      };
    })
  );

  const overallAdherence =
    medsWithStats.length > 0
      ? Math.round(medsWithStats.reduce((a, m) => a + m.adherence, 0) / medsWithStats.length)
      : 0;

  return {
    patient,
    period: { from: start, to: end },
    overallAdherence,
    medications: medsWithStats,
    generatedAt: new Date(),
  };
}

export async function generatePDF(report, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=medai-report-${report.patient._id}.pdf`
  );
  doc.pipe(res);

  doc.fontSize(22).font('Helvetica-Bold').text('MedAI Medication Adherence Report', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica').fillColor('#666').text(`Generated: ${format(report.generatedAt, 'PPpp')}`, { align: 'center' });
  doc.moveDown(1.5);

  doc.fontSize(14).font('Helvetica-Bold').fillColor('#000').text('Patient Information');
  doc.moveDown(0.3);
  doc.fontSize(11).font('Helvetica');
  doc.text(`Name: ${report.patient.fullName}`);
  doc.text(`Email: ${report.patient.email}`);
  doc.text(`Report Period: ${format(report.period.from, 'PP')} – ${format(report.period.to, 'PP')}`);
  doc.moveDown(1);

  doc.fontSize(14).font('Helvetica-Bold').text('Overall Adherence');
  doc.moveDown(0.3);
  const adherenceColor = report.overallAdherence >= 80 ? '#16a34a' : report.overallAdherence >= 60 ? '#d97706' : '#dc2626';
  doc.fontSize(28).fillColor(adherenceColor).text(`${report.overallAdherence}%`, { align: 'center' });
  doc.moveDown(1);

  doc.fillColor('#000').fontSize(14).font('Helvetica-Bold').text('Medications Breakdown');
  doc.moveDown(0.5);

  for (const item of report.medications) {
    doc.fontSize(12).font('Helvetica-Bold').text(`${item.medication.name} (${item.medication.dosage})`);
    doc.fontSize(10).font('Helvetica');
    doc.text(`  Adherence: ${item.adherence}%  |  Taken: ${item.taken}  |  Missed: ${item.missed}  |  Delayed: ${item.delayed}  |  Total: ${item.total}`);
    doc.moveDown(0.5);
  }

  doc.end();
}
