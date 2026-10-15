import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

export const DOCTOR_SIGNATURE_BUCKET = 'doctor_signature_files';

export function createGridFsDoctorSignatureStorage({ connection = mongoose.connection, bucketName = DOCTOR_SIGNATURE_BUCKET } = {}) {
  function bucket() {
    if (!connection?.db) throw new Error('Doctor-signature storage is unavailable.');
    return new mongoose.mongo.GridFSBucket(connection.db, { bucketName });
  }
  return Object.freeze({
    async upload({ buffer, mimeType }) {
      return new Promise((resolve, reject) => {
        const stream = bucket().openUploadStream(`${randomUUID()}.png`, {
          contentType: mimeType,
          metadata: { purpose: 'doctor_certificate_signature' },
        });
        stream.once('error', reject);
        stream.once('finish', () => resolve({ storageFileId: stream.id }));
        stream.end(buffer);
      });
    },
    openDownload(storageFileId) {
      return bucket().openDownloadStream(new mongoose.Types.ObjectId(storageFileId));
    },
    async delete(storageFileId) {
      try { await bucket().delete(new mongoose.Types.ObjectId(storageFileId)); }
      catch (error) { if (error?.code !== 'ENOENT' && error?.code !== 26) throw error; }
    },
  });
}
