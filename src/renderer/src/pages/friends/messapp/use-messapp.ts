import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { messapp } from "./client";
import { fetchFriends, signOut, unlockKeyring, type FriendRow } from "./api";
import { createKeyring, type DmKeyring } from "./dm-crypto";

const friendsCacheKey = (userId: string) => `messapp:friends:${userId}`;

const readFriendsCache = (userId: string): FriendRow[] => {
  try {
    return JSON.parse(localStorage.getItem(friendsCacheKey(userId)) ?? "[]");
  } catch {
    return [];
  }
};

// Supabase refreshes the access token in the background; reading it fresh
// each time (rather than from a closure) keeps the main process's session
// check from failing on a token that expired since the last render.
const currentAccessToken = async () =>
  (await messapp.auth.getSession()).data.session?.access_token ?? null;

export function useMessapp() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [keyring, setKeyring] = useState<DmKeyring | null>(null);
  const [friends, setFriends] = useState<FriendRow[]>([]);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    messapp.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data } = messapp.auth.onAuthStateChange((_event, next) =>
      setSession(next)
    );

    return () => data.subscription.unsubscribe();
  }, []);

  // The cache shows the last list instantly and while offline.
  const refreshFriends = useCallback(async () => {
    if (!userId) return;

    const rows = await fetchFriends(userId);
    setFriends(rows);
    localStorage.setItem(friendsCacheKey(userId), JSON.stringify(rows));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setFriends([]);
      setKeyring(null);
      return;
    }

    setFriends(readFriendsCache(userId));
    refreshFriends().catch(() => {});

    // Saved by a previous unlock; encrypted at rest by the OS in the main process,
    // and keyed there by a session the main process verifies for itself.
    (async () => {
      const token = await currentAccessToken();
      if (!token) return;

      const saved = await window.electron.loadMessappKey(token);
      if (saved) setKeyring(await createKeyring(JSON.parse(saved)));
    })().catch(() => {});
  }, [userId, refreshFriends]);

  const unlock = useCallback(async (pin: string) => {
    const token = await currentAccessToken();
    if (!token) throw new Error("Not signed in");

    const { keyring: unlocked, privateJwk } = await unlockKeyring(pin);
    await window.electron.saveMessappKey(token, privateJwk);
    setKeyring(unlocked);
  }, []);

  const logout = useCallback(async () => {
    const token = await currentAccessToken();
    if (token) await window.electron.clearMessappKey(token);
    setKeyring(null);
    await signOut();
  }, []);

  return { ready, userId, keyring, friends, refreshFriends, unlock, logout };
}
