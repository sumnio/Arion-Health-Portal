import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

export const PWD_VERIFICATION_BUCKET = 'pwd_verification_files';

export function createGridFsPwdVerificationStorage({
  connection = mongoose.connection,
  bucketName = PWD_VERIFICATION_BUCKET,
} = {}) {
  function bucket() {
    if (!connection?.db) throw new Error('PWD verification storage is unavailable.');
    return new mongoose.mongo.GridFSBucket(connection.db, { bucketName });
  }
  return Object.freeze({
    async upload({ buffer, extension, mimeType }, { side = 'legacy' } = {}) {
      const storedFilename = `${randomUUID()}.${extension}`;
      return new Promise((resolve, reject) => {
        const stream = bucket().openUploadStream(storedFilename, {
          contentType: mimeType,
          metadata: { purpose: 'pwd_verification_document', side },
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
