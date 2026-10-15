import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

export const CERTIFICATE_PDF_BUCKET = 'medical_certificate_files';

export function createGridFsCertificateArtifactStorage({ connection = mongoose.connection, bucketName = CERTIFICATE_PDF_BUCKET } = {}) {
  function bucket() {
    if (!connection?.db) throw new Error('Certificate PDF storage is unavailable.');
    return new mongoose.mongo.GridFSBucket(connection.db, { bucketName });
  }
  return Object.freeze({
    async upload(buffer) {
      return new Promise((resolve, reject) => {
        const stream = bucket().openUploadStream(`${randomUUID()}.pdf`, {
          contentType: 'application/pdf',
          metadata: { purpose: 'immutable_medical_certificate' },
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
