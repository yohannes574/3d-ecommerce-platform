const Notification = require('../models/Notification');
const { asyncHandler } = require('../utils/helpers');

/** GET /api/notifications?unread=1 — my feed, newest first (cap 30) */
exports.list = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.unread === '1') filter.read = false;

  const [notifications, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(30),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  res.json({ notifications, unread });
});

/** GET /api/notifications/unread-count — cheap poll for the navbar badge */
exports.unreadCount = asyncHandler(async (req, res) => {
  const unread = await Notification.countDocuments({ user: req.user._id, read: false });
  res.json({ unread });
});

/** PATCH /api/notifications/:id/read */
exports.markRead = asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true });
  res.json({ message: 'Marked read.' });
});

/** PATCH /api/notifications/read-all */
exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ message: 'All marked read.' });
});
