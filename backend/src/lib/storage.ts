import { randomUUID } from 'crypto';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const getStorage = () => {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SECRET_KEY precisam estar configuradas no backend.');
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'documentos';

  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(bucket);
};

export const uploadFile = async (file: Express.Multer.File, folder: string) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const objectPath = `${folder}/${randomUUID()}${extension}`;
  const { error } = await getStorage().upload(objectPath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });

  if (error) throw error;
  return objectPath;
};

export const getDocumentUrl = async (storedPath: string) => {
  if (storedPath.startsWith('/uploads/')) return storedPath;

  const { data, error } = await getStorage().createSignedUrl(storedPath, 60 * 15);
  if (error) throw error;
  return data.signedUrl;
};

export const deleteFile = async (storedPath: string) => {
  if (storedPath.startsWith('/uploads/')) return;
  const { error } = await getStorage().remove([storedPath]);
  if (error) throw error;
};
