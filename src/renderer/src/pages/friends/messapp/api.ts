import { messapp } from "./client";
import { unwrapPrivateKey } from "./crypto";
import { createKeyring, type DmKeyring } from "./dm-crypto";

export interface MessappProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  unique_tag: string | null;
  public_key: string | null;
  status_text: string | null;
}

export interface Friendship {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
}

export interface FriendRow {
  friendship: Friendship;
  profile: MessappProfile;
}

export interface DmMessage {
  id: string;
  profile_id: string;
  content: string;
  created_at: string;
}

const PROFILE_COLUMNS =
  "id, username, avatar_url, unique_tag, public_key, status_text";

const orThrow = <T>({
  data,
  error,
}: {
  data: T | null;
  error: { message: string } | null;
}) => {
  if (error) throw new Error(error.message);
  return data as T;
};

export const signIn = async (email: string, password: string) => {
  const { error } = await messapp.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
};

export const signOut = () => messapp.auth.signOut();

export const fetchFriends = async (myId: string): Promise<FriendRow[]> => {
  const friendships = orThrow<Friendship[]>(
    await messapp
      .from("friendships")
      .select("id, sender_id, receiver_id, status")
  );
  if (!friendships.length) return [];

  const otherId = (f: Friendship) =>
    f.sender_id === myId ? f.receiver_id : f.sender_id;

  const profiles = orThrow<MessappProfile[]>(
    await messapp
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .in("id", [...new Set(friendships.map(otherId))])
  );
  const byId = new Map(profiles.map((p) => [p.id, p]));

  return friendships.flatMap((friendship) => {
    const profile = byId.get(otherId(friendship));
    return profile ? [{ friendship, profile }] : [];
  });
};

export const searchProfiles = async (query: string) =>
  orThrow<MessappProfile[]>(
    await messapp.rpc("search_profiles_for_friend", { search_query: query })
  );

export const sendFriendRequest = async (myId: string, targetId: string) =>
  orThrow(
    await messapp
      .from("friendships")
      .insert({ sender_id: myId, receiver_id: targetId })
  );

export const acceptFriendRequest = async (friendshipId: string) =>
  orThrow(
    await messapp
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId)
  );

export const removeFriendship = async (friendshipId: string) =>
  orThrow(await messapp.from("friendships").delete().eq("id", friendshipId));

export const openDm = async (peerId: string) =>
  orThrow<{ id: string }>(
    await messapp.rpc("create_or_get_dm", { peer_id: peerId })
  ).id;

export const fetchMessages = async (roomId: string) => {
  const rows = orThrow<DmMessage[]>(
    await messapp
      .from("messages")
      .select("id, profile_id, content, created_at")
      .eq("dm_room_id", roomId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(100)
  );

  return rows.toReversed();
};

export const sendMessage = async (
  myId: string,
  roomId: string,
  content: string
) =>
  orThrow<DmMessage>(
    await messapp
      .from("messages")
      .insert({
        profile_id: myId,
        dm_room_id: roomId,
        content,
        is_encrypted: true,
      })
      .select("id, profile_id, content, created_at")
      .single()
  );

export const subscribeToRoom = (
  roomId: string,
  onMessage: (message: DmMessage) => void
) => {
  const channel = messapp
    .channel(`chimaera-dm-${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `dm_room_id=eq.${roomId}`,
      },
      (payload) => onMessage(payload.new as DmMessage)
    )
    .subscribe();

  return () => {
    void messapp.removeChannel(channel);
  };
};

/**
 * Opens the PIN-wrapped key backup. Read-only on purpose: a wrong or
 * regenerated key written back would lock users out of MESSAPP history.
 */
export const unlockKeyring = async (
  pin: string
): Promise<{ keyring: DmKeyring; privateJwk: string }> => {
  const secrets = orThrow<
    { encrypted_private_key: string | null; public_key: string | null }[]
  >(await messapp.rpc("get_my_profile_secrets"))[0];

  if (!secrets?.encrypted_private_key) {
    throw new Error("No key backup. Set a PIN in MESSAPP first.");
  }

  const jwk = await unwrapPrivateKey(pin, secrets.encrypted_private_key);
  const keyring = await createKeyring(jwk);

  // A different public half would mean decrypting with someone else's key.
  if (secrets.public_key) {
    const published = JSON.parse(secrets.public_key);
    if (published.x !== keyring.publicJwk.x) {
      throw new Error("Key backup does not match your published key.");
    }
  }

  return { keyring, privateJwk: JSON.stringify(jwk) };
};
