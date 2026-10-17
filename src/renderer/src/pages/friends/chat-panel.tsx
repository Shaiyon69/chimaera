import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, TextField } from "@renderer/components";
import {
  fetchMessages,
  openDm,
  sendMessage,
  subscribeToRoom,
  type DmMessage,
  type MessappProfile,
} from "./messapp/api";
import { decryptDm, encryptDm, type DmKeyring } from "./messapp/dm-crypto";

interface ChatLine {
  id: string;
  mine: boolean;
  text: string | null;
  createdAt: string;
}

interface ChatPanelProps {
  userId: string;
  peer: MessappProfile;
  keyring: DmKeyring | null;
  onUnlock: (pin: string) => Promise<void>;
}

function UnlockForm({
  onUnlock,
}: Readonly<{ onUnlock: (pin: string) => Promise<void> }>) {
  const { t } = useTranslation("messapp");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await onUnlock(pin);
    } catch (err) {
      setError(
        err instanceof Error && err.message.startsWith("No key backup")
          ? t("no_backup")
          : t("wrong_pin")
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="friends__unlock" onSubmit={submit}>
      <h3 className="friends__title">{t("unlock_title")}</h3>
      <p className="friends__hint">{t("unlock_description")}</p>
      <TextField
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        aria-label={t("pin")}
        value={pin}
        onChange={(event) => setPin(event.target.value.replaceAll(/\D/g, ""))}
        error={error}
      />
      <Button type="submit" disabled={busy || pin.length !== 6}>
        {busy ? t("unlocking") : t("unlock")}
      </Button>
    </form>
  );
}

export function ChatPanel({
  userId,
  peer,
  keyring,
  onUnlock,
}: Readonly<ChatPanelProps>) {
  const { t } = useTranslation("messapp");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const peerKey = useMemo<JsonWebKey | null>(() => {
    try {
      return peer.public_key ? JSON.parse(peer.public_key) : null;
    } catch {
      return null;
    }
  }, [peer.public_key]);

  const toLine = useCallback(
    async (message: DmMessage): Promise<ChatLine> => {
      const mine = message.profile_id === userId;
      return {
        id: message.id,
        mine,
        text: keyring
          ? await decryptDm(keyring, message.content, mine, peerKey)
          : null,
        createdAt: message.created_at,
      };
    },
    [keyring, peerKey, userId]
  );

  // The sender's own insert also arrives over realtime, so appends dedupe by id.
  const appendLine = useCallback(
    (line: ChatLine) =>
      setLines((current) =>
        current.some((l) => l.id === line.id) ? current : [...current, line]
      ),
    []
  );

  useEffect(() => {
    if (!keyring) return;

    let cancelled = false;
    let unsubscribe = () => {};

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const room = await openDm(peer.id);
        const history = await Promise.all(
          (await fetchMessages(room)).map(toLine)
        );
        if (cancelled) return;

        setRoomId(room);
        setLines(history);

        unsubscribe = subscribeToRoom(room, async (message) => {
          const line = await toLine(message);
          if (!cancelled) appendLine(line);
        });
      } catch {
        if (!cancelled) setError(t("action_failed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [keyring, peer.id, toLine, appendLine, t]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  if (!keyring) return <UnlockForm onUnlock={onUnlock} />;
  if (!peerKey) return <p className="friends__empty">{t("peer_no_key")}</p>;

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !roomId || sending) return;

    setSending(true);
    setError(null);

    try {
      const row = await sendMessage(
        userId,
        roomId,
        await encryptDm(keyring, peerKey, text)
      );
      appendLine(await toLine(row));
      setDraft("");
    } catch {
      // The draft stays so the user can retry.
      setError(t("send_failed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="friends__thread">
      <h3 className="friends__title">{peer.username}</h3>

      <div
        className="friends__messages"
        role="log"
        aria-live="polite"
        aria-label={t("conversation_with", { name: peer.username })}
      >
        {loading && <p className="friends__empty">{t("loading_messages")}</p>}
        {!loading && !error && lines.length === 0 && (
          <p className="friends__empty">
            {t("no_messages", { name: peer.username })}
          </p>
        )}
        {lines.map((line) => (
          <div
            key={line.id}
            className={`friends__bubble ${line.mine ? "friends__bubble--mine" : ""}`}
            title={new Date(line.createdAt).toLocaleString()}
          >
            {line.text ?? (
              <span className="friends__bubble-unreadable">
                {t("unreadable")}
              </span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="friends__error" role="alert">
          {error}
        </p>
      )}

      <form className="friends__composer" onSubmit={send}>
        <TextField
          aria-label={t("message_placeholder")}
          placeholder={t("message_placeholder")}
          autoComplete="off"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" disabled={!draft.trim() || !roomId || sending}>
          {t("send")}
        </Button>
      </form>
    </div>
  );
}
