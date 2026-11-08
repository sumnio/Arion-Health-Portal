import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

export const PRESCRIPTION_ATTACHMENT_BUCKET = 'prescription_files';

export function createGridFsPrescriptionAttachmentStorage({
  connection = mongoose.connection,
  bucketName = PRESCRIPTION_ATTACHMENT_BUCKET,
} = {}) {
  function bucket() {
    if (!connection?.db) throw new Error('Prescription attachment storage is unavailable.');
    return new mongoose.mongo.GridFSBucket(connection.db, { bucketName });
  }

  return Object.freeze({
    async upload({ buffer, extension, mimeType }) {
      const storedFilename = `${randomUUID()}.${extension}`;
      return new Promise((resolve, reject) => {
        const stream = bucket().openUploadStream(storedFilename, {
          contentType: mimeType,
          metadata: { purpose: 'prescription_attachment' },
        });
        stream.once('error', reject);
        stream.once('finish', () => resolve({ storageFileId: stream.id, storedFilename }));
        stream.end(buffer);
      });
    },
    openDownload(storageFileId) {
      return bucket().openDownloadStream(new mongoose.Types.ObjectId(storageFileId));
    },
    async delete(storageFileId) {
      try {
        await bucket().delete(new mongoose.Types.ObjectId(storageFileId));
      } catch (error) {
        if (error?.code !== 'ENOENT' && error?.code !== 26) throw error;
      }
    },
  });
}
