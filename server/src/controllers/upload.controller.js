const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = /\.(jpe?g|png|webp|gif|glb|pdf)$/i; // general uploads
const LICENSE_ALLOWED = /\.(jpe?g|png|webp|pdf)$/i; // business-license documents
const LICENSE_MAX_MB = 10;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 64 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.test(path.extname(file.originalname))) {
      return cb(new Error('Only images (jpg/png/webp/gif), .pdf documents and .glb models are allowed.'));
    }
    cb(null, true);
  },
});

const kindFor = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.glb') return 'model';
  if (ext === '.pdf') return 'document';
  return 'image';
};

/* Magic-byte sniffing: extensions lie, file headers usually don't. */
function sniffKind(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    try {
      const buf = Buffer.alloc(16);
      const bytes = fs.readSync(fd, buf, 0, 16, 0);
      const hex = buf.slice(0, bytes).toString('hex');
      const ascii = buf.slice(0, bytes).toString('latin1');
      if (hex.startsWith('ffd8ff')) return 'image/jpeg';
      if (hex.startsWith('89504e47')) return 'image/png';
      if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image/webp';
      if (ascii.startsWith('GIF8')) return 'image/gif';
      if (ascii.startsWith('%PDF')) return 'document/pdf';
      if (ascii.startsWith('glTF')) return 'model/gltf-binary';
      return 'unknown';
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return 'unknown';
  }
}

const EXT_TO_SNIFF = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'document/pdf',
  '.glb': 'model/gltf-binary',
};

/** Delete an uploaded file (best-effort) — used when validation fails. */
function removeUploaded(filePath) {
  fs.unlink(filePath, () => {});
}

/** Verify the real content matches the claimed extension; 400 otherwise. */
async function verifyMagic(req, res, allowedExts) {
  const ext = path.extname(req.file.originalname).toLowerCase();
  const expected = EXT_TO_SNIFF[ext];
  const actual = await sniffKind(req.file.path);
  const ok = expected && actual === expected && allowedExts.includes(ext);
  if (!ok) {
    removeUploaded(req.file.path);
    res.status(400).json({
      message: `File content (${actual}) does not match its extension (${ext || 'none'}). Rejected.`,
    });
    return false;
  }
  return true;
}

/** POST /api/upload (multipart field: "file") → { url, kind, size } */
exports.uploadFile = [
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file received. Send multipart form-data with a "file" field.' });
    }
    if (!(await verifyMagic(req, res, Object.keys(EXT_TO_SNIFF)))) return;
    const url = `/uploads/${req.file.filename}`;
    res.status(201).json({ url, kind: kindFor(req.file.originalname), size: req.file.size });
  },
];

/** POST /api/upload/payment (multipart "file") — payment receipt screenshot, image ≤ 5 MB */
exports.uploadPaymentProof = [
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file received. Send multipart form-data with a "file" field.' });
    }
    if (!(await verifyMagic(req, res, ['.jpg', '.jpeg', '.png', '.webp']))) return;
    if (req.file.size > 5 * 1024 * 1024) {
      removeUploaded(req.file.path);
      return res.status(400).json({ message: 'Payment screenshot must be under 5 MB.' });
    }
    const url = `/uploads/${req.file.filename}`;
    res.status(201).json({ url, kind: 'image', size: req.file.size });
  },
];

/** POST /api/upload/license (multipart "file") — seller business license, pdf/image ≤ 10 MB */
exports.uploadLicense = [
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file received. Send multipart form-data with a "file" field.' });
    }
    if (!(await verifyMagic(req, res, ['.pdf', '.jpg', '.jpeg', '.png', '.webp']))) return;
    if (req.file.size > LICENSE_MAX_MB * 1024 * 1024) {
      removeUploaded(req.file.path);
      return res.status(400).json({ message: `License file must be under ${LICENSE_MAX_MB} MB.` });
    }
    const url = `/uploads/${req.file.filename}`;
    res.status(201).json({ url, kind: 'document', size: req.file.size });
  },
];
