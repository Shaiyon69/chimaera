import axios from "axios";

const MESSAPP_URL = "https://boxhdygkyopixoejztuk.supabase.co";
const MESSAPP_PUBLISHABLE_KEY =
  "sb_publishable_DAB7bLq6qy7r9bdWu8empA_ED55mzMa";

/**
 * Resolves a Supabase access token to the user id it actually authenticates as.
 * The renderer is untrusted, so the key-store IPC must not take a caller-supplied
 * userId at face value: asking Supabase itself is what makes "I am this user"
 * provable rather than merely claimed.
 */
export const verifyMessappSession = async (
  accessToken: string
): Promise<string> => {
  if (!accessToken) throw new Error("Missing access token");

  const { data } = await axios.get<{ id?: string }>(
    `${MESSAPP_URL}/auth/v1/user`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: MESSAPP_PUBLISHABLE_KEY,
      },
      timeout: 10000,
    }
  );

  if (!data?.id) throw new Error("Session verification returned no user id");
  return data.id;
};
