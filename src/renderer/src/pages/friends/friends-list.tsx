import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Avatar,
  Button,
  ConfirmationModal,
  TextField,
} from "@renderer/components";
import {
  acceptFriendRequest,
  removeFriendship,
  searchProfiles,
  sendFriendRequest,
  type FriendRow,
  type MessappProfile,
} from "./messapp/api";
import { isNetworkError } from "./messapp/errors";

interface FriendsListProps {
  userId: string;
  friends: FriendRow[];
  activeId: string | null;
  onSelect: (friend: FriendRow) => void;
  onChanged: () => Promise<void>;
  onSignOut: () => void;
}

export function FriendsList({
  userId,
  friends,
  activeId,
  onSelect,
  onChanged,
  onSignOut,
}: Readonly<FriendsListProps>) {
  const { t } = useTranslation("messapp");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MessappProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [removing, setRemoving] = useState<FriendRow | null>(null);

  const accepted = friends.filter((f) => f.friendship.status === "accepted");
  const incoming = friends.filter(
    (f) =>
      f.friendship.status === "pending" && f.friendship.receiver_id === userId
  );
  const outgoing = friends.filter(
    (f) =>
      f.friendship.status === "pending" && f.friendship.sender_id === userId
  );

  // Each action refreshes the list; failures map to one of two calm messages, never raw SDK text.
  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (err) {
      setError(t(isNetworkError(err) ? "network_error" : "action_failed"));
    }
  };

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      const found = await searchProfiles(query.trim());
      setResults(found.filter((p) => p.id !== userId));
      setSearched(true);
    } catch (err) {
      setError(t(isNetworkError(err) ? "network_error" : "action_failed"));
    }
  };

  const known = new Set(friends.map((f) => f.profile.id));

  return (
    <aside className="friends__list">
      <form className="friends__search" onSubmit={search}>
        <TextField
          placeholder={t("search_placeholder")}
          aria-label={t("search_placeholder")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearched(false);
          }}
        />
      </form>

      {error && (
        <p className="friends__error" role="alert">
          {error}
        </p>
      )}

      {searched && results.length === 0 && (
        <p className="friends__empty">{t("no_results")}</p>
      )}

      {results.length > 0 && (
        <ul className="friends__group">
          {results.map((profile) => (
            <li key={profile.id} className="friends__row">
              <Avatar
                size={32}
                src={profile.avatar_url}
                alt={profile.username}
              />
              <span className="friends__name">{profile.username}</span>
              <Button
                theme="outline"
                disabled={known.has(profile.id)}
                aria-label={t("add_named", { name: profile.username })}
                onClick={() =>
                  run(async () => {
                    await sendFriendRequest(userId, profile.id);
                    setResults([]);
                    setQuery("");
                    setSearched(false);
                  })
                }
              >
                {t("add_friend")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {incoming.length > 0 && (
        <>
          <h3 className="friends__heading">{t("requests")}</h3>
          <ul className="friends__group">
            {incoming.map(({ friendship, profile }) => (
              <li key={friendship.id} className="friends__row">
                <Avatar
                  size={32}
                  src={profile.avatar_url}
                  alt={profile.username}
                />
                <span className="friends__name">{profile.username}</span>
                <Button
                  aria-label={t("accept_named", { name: profile.username })}
                  onClick={() => run(() => acceptFriendRequest(friendship.id))}
                >
                  {t("accept")}
                </Button>
                <Button
                  theme="outline"
                  aria-label={t("decline_named", { name: profile.username })}
                  onClick={() => run(() => removeFriendship(friendship.id))}
                >
                  {t("decline")}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="friends__heading">{t("friends")}</h3>
      {accepted.length === 0 && (
        <p className="friends__empty">{t("no_friends")}</p>
      )}
      <ul className="friends__group">
        {accepted.map((friend) => (
          <li key={friend.friendship.id} className="friends__row">
            <button
              type="button"
              className={`friends__select ${
                activeId === friend.profile.id ? "friends__select--active" : ""
              }`}
              aria-current={activeId === friend.profile.id ? "true" : undefined}
              onClick={() => onSelect(friend)}
            >
              <Avatar
                size={32}
                src={friend.profile.avatar_url}
                alt={friend.profile.username}
              />
              <span className="friends__name">{friend.profile.username}</span>
            </button>
            <Button
              theme="outline"
              aria-label={t("remove_named", {
                name: friend.profile.username,
              })}
              onClick={() => setRemoving(friend)}
            >
              {t("remove")}
            </Button>
          </li>
        ))}
      </ul>

      {outgoing.length > 0 && (
        <>
          <h3 className="friends__heading">{t("sent")}</h3>
          <ul className="friends__group">
            {outgoing.map(({ friendship, profile }) => (
              <li key={friendship.id} className="friends__row">
                <Avatar
                  size={32}
                  src={profile.avatar_url}
                  alt={profile.username}
                />
                <span className="friends__name">{profile.username}</span>
                <Button
                  theme="outline"
                  aria-label={t("cancel_named", { name: profile.username })}
                  onClick={() => run(() => removeFriendship(friendship.id))}
                >
                  {t("cancel")}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="friends__sign-out">
        <Button theme="outline" onClick={onSignOut}>
          {t("sign_out")}
        </Button>
      </div>

      <ConfirmationModal
        visible={!!removing}
        title={t("remove_friend_title")}
        descriptionText={t("remove_friend_confirm", {
          name: removing?.profile.username ?? "",
        })}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          const friendship = removing?.friendship.id;
          setRemoving(null);
          if (friendship) void run(() => removeFriendship(friendship));
        }}
        cancelButtonLabel={t("cancel")}
        confirmButtonLabel={t("remove")}
        confirmButtonTheme="danger"
      />
    </aside>
  );
}
