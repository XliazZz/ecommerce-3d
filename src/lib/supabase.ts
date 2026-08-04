import { createClient } from '@supabase/supabase-js';

declare global {
    interface ImportMetaEnv {
        readonly PUBLIC_SUPABASE_URL: string;
        readonly PUBLIC_SUPABASE_ANON_KEY: string;
    }
}

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);