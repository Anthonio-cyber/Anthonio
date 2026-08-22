import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from './config.js';
import { HttpError } from './util.js';

const FOLDERS = ['avatars', 'posts', 'clubs', 'homework', 'messages'];
for (const folder of FOLDERS) {
  fs.mkdirSync(path.join(config.uploadDir, folder), { recursive: true });
}

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const DOC_TYPES = new Set(['application/pdf', 'text/plain', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

function storageFor(folder) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(config.uploadDir, folder)),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 10).replace(/[^a-z0-9.]/g, '');
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext || '.dat'}`);
    }
  });
}

/** Image-only uploader (avatars, post pictures, club art). */
export function imageUploader(folder) {
  return multer({
    storage: storageFor(folder),
    limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (IMAGE_TYPES.has(file.mimetype)) return cb(null, true);
      return cb(new HttpError(400, 'Only PNG, JPG, WEBP or GIF images can be uploaded.'));
    }
  });
}

/** Homework attachments: images plus a few document types. */
export function attachmentUploader(folder) {
  return multer({
    storage: storageFor(folder),
    limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (IMAGE_TYPES.has(file.mimetype) || DOC_TYPES.has(file.mimetype)) return cb(null, true);
      return cb(new HttpError(400, 'That file type is not allowed.'));
    }
  });
}

export const publicUrl = (folder, filename) => `/uploads/${folder}/${filename}`;
