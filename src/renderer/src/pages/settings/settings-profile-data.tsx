import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Avatar, Button, TextField } from "@renderer/components";
import { useToast, useUserDetails } from "@renderer/hooks";

import "./settings-profile-data.scss";

const hours = (ms: number) => (ms / 3_600_000).toFixed(1);

/** Everything about the user is local: no Hydra account to manage. */
export function SettingsProfileData() {
  const { t } = useTranslation("settings");
  const { showSuccessToast, showErrorToast } = useToast();
  const { userDetails, patchUser } = useUserDetails();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<Awaited<
    ReturnType<typeof window.electron.getPlaytimeSummary>
  > | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    setDisplayName(userDetails?.displayName ?? "");
    setBio(userDetails?.bio ?? "");
  }, [userDetails?.displayName, userDetails?.bio]);

  useEffect(() => {
    void window.electron.getPlaytimeSummary().then(setSummary);
  }, []);

  const save = async (values: Parameters<typeof patchUser>[0]) => {
    setSaving(true);
    try {
      await patchUser(values);
      showSuccessToast(t("changes_saved"));
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async (field: "profileImageUrl" | "backgroundImageUrl") => {
    const { filePaths, canceled } = await window.electron.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
      ],
    });
    if (!canceled && filePaths[0]) await save({ [field]: filePaths[0] });
  };

  const importBackup = async () => {
    setImporting(true);
    try {
      const result = await window.electron.importHydraBackup();
      if (result) {
        showSuccessToast(
          t("profile_data_imported", {
            games: result.games,
            unlocks: result.unlocks,
          })
        );
        setSummary(await window.electron.getPlaytimeSummary());
      }
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="settings-profile-data">
      <section className="settings-profile-data__section">
        <h3>{t("profile_data_profile")}</h3>
        <div className="settings-profile-data__avatar">
          <Avatar
            size={72}
            src={userDetails?.profileImageUrl}
            alt={userDetails?.displayName}
          />
          <div className="settings-profile-data__actions">
            <Button
              theme="outline"
              disabled={saving}
              onClick={() => void pickImage("profileImageUrl")}
            >
              {t("profile_data_change_avatar")}
            </Button>
            <Button
              theme="outline"
              disabled={saving}
              onClick={() => void pickImage("backgroundImageUrl")}
            >
              {t("profile_data_change_background")}
            </Button>
          </div>
        </div>
        <TextField
          label={t("profile_data_name")}
          value={displayName}
          maxLength={64}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <TextField
          label={t("profile_data_bio")}
          value={bio}
          maxLength={1000}
          onChange={(e) => setBio(e.target.value)}
        />
        <div>
          <Button
            theme="primary"
            disabled={saving || !displayName.trim()}
            onClick={() => void save({ displayName: displayName.trim(), bio })}
          >
            {t("save_changes")}
          </Button>
        </div>
      </section>

      <section className="settings-profile-data__section">
        <h3>{t("profile_data_playtime")}</h3>
        {summary && (
          <>
            <p>
              {t("profile_data_total", {
                hours: hours(summary.totalPlayTimeInMilliseconds),
                played: summary.playedGameCount,
                games: summary.gameCount,
              })}
            </p>
            <ol className="settings-profile-data__top">
              {summary.mostPlayed.map((g) => (
                <li key={`${g.shop}:${g.objectId}`}>
                  {g.title ?? g.objectId} · {hours(g.playTimeInMilliseconds)} h
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <section className="settings-profile-data__section">
        <h3>{t("profile_data_data")}</h3>
        <p>{t("profile_data_data_hint")}</p>
        <div className="settings-profile-data__actions">
          <Button
            theme="outline"
            disabled={importing}
            onClick={() => void importBackup()}
          >
            {importing ? t("profile_data_importing") : t("profile_data_import")}
          </Button>
          <Button
            theme="outline"
            onClick={() => void window.electron.openHydraBackupsFolder()}
          >
            {t("profile_data_open_backups")}
          </Button>
        </div>
      </section>
    </div>
  );
}
