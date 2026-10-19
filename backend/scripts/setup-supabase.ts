import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'documentos';

if (!url || !secretKey) {
  throw new Error('SUPABASE_URL e SUPABASE_SECRET_KEY precisam estar configuradas.');
}

const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data: existing, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  if (existing.some((item) => item.name === bucket)) {
    console.log(`Bucket privado "${bucket}" ja existe.`);
    return;
  }

  const { error } = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: 20 * 1024 * 1024,
  });
  if (error) throw error;
  console.log(`Bucket privado "${bucket}" criado.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
