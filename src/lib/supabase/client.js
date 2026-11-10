import { createBrowserClient } from '@supabase/ssr';

let browserClient;

const DEFAULT_SUPABASE_URL = 'https://iqpjpvwfqmykbebtqcpn.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ttSRYElM9OT7WBh3scZWQw_IEsEUWzM';

export function getPublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

  return { url, publishableKey };
}

export function createClient() {
  if (!browserClient) {
    const { url, publishableKey } = getPublicConfig();
    browserClient = createBrowserClient(url, publishableKey);
  }

  return browserClient;
}
