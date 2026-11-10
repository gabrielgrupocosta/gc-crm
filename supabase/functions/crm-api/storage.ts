import type { DatabaseClient } from './types.ts';

const DEFAULT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const storageBucket = (): string => Deno.env.get('SUPABASE_STORAGE_BUCKET')?.trim() || 'documentos';

const allowedMimeTypes = (): Set<string> => {
  const configured = Deno.env.get('UPLOAD_ALLOWED_MIME_TYPES')
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return new Set(configured?.length ? configured : DEFAULT_MIME_TYPES);
};

const extensionFromName = (name: string): string => {
  const match = name.toLowerCase().match(/(\.[a-z0-9]{1,10})$/);
  return match?.[1] || '';
};

export const validateUpload = (file: File): string | null => {
  if (file.size <= 0) return 'Arquivo vazio.';
  if (file.size > 20 * 1024 * 1024) return 'Arquivo excede o limite de 20 MB.';
  if (!allowedMimeTypes().has(file.type)) return 'Tipo de arquivo nao permitido.';
  return null;
};

export const uploadFile = async (
  db: DatabaseClient,
  file: File,
  folder: string,
): Promise<string> => {
  const objectPath = `${folder}/${crypto.randomUUID()}${extensionFromName(file.name)}`;
  const bytes = await file.arrayBuffer();
  const { error } = await db.storage.from(storageBucket()).upload(objectPath, bytes, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw error;
  return objectPath;
};

export const deleteStoredFile = async (db: DatabaseClient, path: string): Promise<void> => {
  if (path.startsWith('/uploads/')) return;
  const { error } = await db.storage.from(storageBucket()).remove([path]);
  if (error) throw error;
};

export const signStoredPath = async (db: DatabaseClient, path: string): Promise<string> => {
  if (path.startsWith('/uploads/')) return path;
  const { data, error } = await db.storage.from(storageBucket()).createSignedUrl(path, 15 * 60);
  if (error) throw error;
  return data.signedUrl;
};

export const signDocuments = async <T extends { urlCaminho: string }>(
  db: DatabaseClient,
  documents: T[],
): Promise<T[]> => {
  const storagePaths = documents
    .map((document) => document.urlCaminho)
    .filter((path) => !path.startsWith('/uploads/'));
  if (storagePaths.length === 0) return documents;

  const { data, error } = await db.storage.from(storageBucket()).createSignedUrls(storagePaths, 15 * 60);
  if (error) throw error;
  const urls = new Map<string, string>();
  for (const signed of data || []) {
    if (signed.path && signed.signedUrl) urls.set(signed.path, signed.signedUrl);
  }

  return documents.map((document) => ({
    ...document,
    urlCaminho: document.urlCaminho.startsWith('/uploads/')
      ? document.urlCaminho
      : urls.get(document.urlCaminho) || document.urlCaminho,
  }));
};

