import { createClient } from "@supabase/supabase-js";

// Publishable key: public by design, row-level security enforces access.
const MESSAPP_URL = "https://boxhdygkyopixoejztuk.supabase.co";
const MESSAPP_PUBLISHABLE_KEY =
  "sb_publishable_DAB7bLq6qy7r9bdWu8empA_ED55mzMa";

export const messapp = createClient(MESSAPP_URL, MESSAPP_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "chimaera-messapp-auth",
  },
});
