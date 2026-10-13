import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

export const SUPPORTING_DOCUMENT_BUCKET = 'consultation_supporting_files';

export function createGridFsSupportingDocumentStorage({
  connection = mongoose.connection,
  bucketName = SUPPORTING_DOCUMENT_BUCKET,
} = {}) {
  function bucket() {
    if (!connection?.db) throw new Error('Supporting-document storage is unavailable.');
    return new mongoose.mongo.GridFSBucket(connection.db, { bucketName });
  }

  return Object.freeze({
    async upload({ buffer, extension, mimeType }) {
      const storedFilename = `${randomUUID()}.${extension}`;
      return new Promise((resolve, reject) => {
        const stream = bucket().openUploadStream(storedFilename, {
          contentType: mimeType,
          metadata: { purpose: 'consultation_supporting_document' },
        });
        stream.once('error', reject);
        stream.once('finish', () => resolve({
          storageFileId: stream.id,
          storedFilename,
        }));
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
