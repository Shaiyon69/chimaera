import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameShop } from "@types";

import { Button } from "@renderer/components";
import { useDate } from "@renderer/hooks";

import "./local-save-backups-section.scss";

interface LocalSaveBackupsSectionProps {
  shop: GameShop;
  objectId: string;
}

export function LocalSaveBackupsSection({
  shop,
  objectId,
}: Readonly<LocalSaveBackupsSectionProps>) {
  const { t } = useTranslation("game_details");
  const { formatDateTime } = useDate();
  const [backups, setBackups] = useState<LocalSaveBackup[]>([]);
  const [folder, setFolder] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBackups(await window.electron.listLocalSaveBackups(shop, objectId));
    setFolder(await window.electron.getSaveBackupsDir());
  }, [shop, objectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (action: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    setConfirm(null);
    try {
      await action();
      if (done) setNotice(done);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  // Restore overwrites the current saves and delete is final: both take two clicks.
  const twoStep = (key: string, action: () => void) => {
    if (confirm !== key) {
      setConfirm(key);
      return;
    }
    action();
  };

  return (
    <div className="local-save-backups">
      <h3>{t("save_backups_title")}</h3>
      <p>{t("save_backups_hint", { folder })}</p>

      <div className="local-save-backups__actions">
        <Button
          theme="primary"
          disabled={busy}
          onClick={() =>
            void run(
              () => window.electron.createLocalSaveBackup(shop, objectId),
              t("save_backups_created")
            )
          }
        >
          {t("save_backups_create")}
        </Button>
        <Button
          theme="outline"
          disabled={busy}
          onClick={() => void run(() => window.electron.selectSaveBackupsDir())}
        >
          {t("save_backups_change_folder")}
        </Button>
        <Button
          theme="outline"
          disabled={busy}
          onClick={() =>
            void window.electron.openLocalSaveBackupsFolder(shop, objectId)
          }
        >
          {t("save_backups_open_folder")}
        </Button>
      </div>

      {backups.length === 0 && <p>{t("save_backups_empty")}</p>}
      <ul className="local-save-backups__list">
        {backups.map((b) => (
          <li key={b.file} className="local-save-backups__row">
            <span className="local-save-backups__label">
              {b.label} · {formatDateTime(b.createdAt)} ·{" "}
              {(b.sizeBytes / 1024 / 1024).toFixed(1)} MB
              {b.hostname ? ` · ${b.hostname}` : ""}
            </span>
            <Button
              theme="outline"
              disabled={busy}
              onClick={() =>
                twoStep(
                  `restore:${b.file}`,
                  () =>
                    void run(
                      () =>
                        window.electron.restoreLocalSaveBackup(
                          shop,
                          objectId,
                          b.file
                        ),
                      t("save_backups_restored")
                    )
                )
              }
            >
              {confirm === `restore:${b.file}`
                ? t("save_backups_restore_confirm")
                : t("save_backups_restore")}
            </Button>
            <Button
              theme="danger"
              disabled={busy}
              onClick={() =>
                twoStep(
                  `delete:${b.file}`,
                  () =>
                    void run(() =>
                      window.electron.deleteLocalSaveBackup(
                        shop,
                        objectId,
                        b.file
                      )
                    )
                )
              }
            >
              {confirm === `delete:${b.file}`
                ? t("save_backups_delete_confirm")
                : t("save_backups_delete")}
            </Button>
          </li>
        ))}
      </ul>

      {notice && <p>{notice}</p>}
      {error && <p className="local-save-backups__error">{error}</p>}
    </div>
  );
}
