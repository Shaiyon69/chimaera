import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, TextField } from "@renderer/components";
import { signIn } from "./messapp/api";
import { classifyAuthError } from "./messapp/errors";
import { useMessapp } from "./messapp/use-messapp";
import { FriendsList } from "./friends-list";
import { ChatPanel } from "./chat-panel";
import type { FriendRow } from "./messapp/api";
import "./friends.scss";

function SignInForm() {
  const { t } = useTranslation("messapp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await signIn(email, password);
    } catch (err) {
      // Never surface the raw SDK message; map what we recognize, fall back to one calm string.
      setError(
        t(
          classifyAuthError(err) === "network"
            ? "network_error"
            : "sign_in_failed"
        )
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="friends__sign-in" onSubmit={submit}>
      <h2 className="friends__title">{t("sign_in_title")}</h2>
      <p className="friends__hint">{t("sign_in_description")}</p>
      <TextField
        label={t("email")}
        type="email"
        autoComplete="username"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <TextField
        label={t("password")}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={error}
      />
      <Button type="submit" disabled={busy || !email || !password}>
        {busy ? t("signing_in") : t("sign_in")}
      </Button>
      <p className="friends__no-account">{t("no_account_hint")}</p>
    </form>
  );
}

export default function Friends() {
  const { t } = useTranslation("messapp");
  const messappState = useMessapp();
  const [active, setActive] = useState<FriendRow | null>(null);

  if (!messappState.ready) return null;
  if (!messappState.userId) return <SignInForm />;

  return (
    <div className="friends">
      <FriendsList
        userId={messappState.userId}
        friends={messappState.friends}
        activeId={active?.profile.id ?? null}
        onSelect={setActive}
        onChanged={messappState.refreshFriends}
        onSignOut={() => {
          setActive(null);
          void messappState.logout();
        }}
      />

      <section className="friends__chat">
        {active ? (
          <ChatPanel
            key={active.profile.id}
            userId={messappState.userId}
            peer={active.profile}
            keyring={messappState.keyring}
            onUnlock={messappState.unlock}
          />
        ) : (
          <p className="friends__empty">{t("select_friend")}</p>
        )}
      </section>
    </div>
  );
}
