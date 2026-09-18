const mongoose = require('mongoose');

/**
 * Append-only audit trail for admin (and other privileged) actions.
 * Written best-effort: audit failures never break the main request.
 */
const auditSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorEmail: { type: String, default: '' },
    action: { type: String, required: true }, // e.g. 'seller.status', 'order.status'
    target: { type: String, default: '' }, // e.g. 'User:665f...'
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
  },
  { timestamps: true }
);

auditSchema.index({ createdAt: -1 });
auditSchema.index({ action: 1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditSchema);

function logAudit(req, action, { target = '', meta = {} } = {}) {
  AuditLog.create({
    actor: req.user?._id,
    actorEmail: req.user?.email || '',
    action,
    target,
    meta,
    ip: req.ip || '',
  }).catch((err) => console.warn('[audit] failed:', err.message));
}

/** GET /api/admin/audit — latest 100 entries */
async function listAudit(req, res) {
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100);
  res.json({ logs });
}

module.exports = { logAudit, listAudit, AuditLog };
