import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Modal } from "../modal/modal";
import { Button } from "../button/button";
import { CheckboxField } from "../checkbox-field/checkbox-field";
import { SelectField } from "../select-field/select-field";
import { TextField } from "../text-field/text-field";
import { BLOODBORNE_CONFIGURED_EVENT, BLOODBORNE_SETUP_EVENT } from "./events";

import "./bloodborne-setup-modal.scss";

const toOptions = (values: string[], label = (v: string) => v) =>
  values.map((v) => ({ key: v, value: v, label: label(v) }));

export function BloodborneSetupModal() {
  const { t } = useTranslation("bloodborne_setup");
  const [setup, setSetup] = useState<BloodborneSetup | null>(null);
  const [settings, setSettings] = useState<BloodborneSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [portProgress, setPortProgress] = useState<{
    phase: "downloading" | "extracting";
    percent: number;
  } | null>(null);
  const [portError, setPortError] = useState<string | null>(null);

  const open = useCallback(async () => {
    const current = await window.electron.getBloodborneSetup();
    setSetup(current);
    setSettings({
      ...current.settings,
      // The port recommends 60 FPS; its own default is uncapped.
      fps: current.configured ? current.settings.fps : "60",
      enabledPatches: current.configured
        ? current.settings.enabledPatches
        : ["Skip Intro"],
    });
    setError(false);
  }, []);

  useEffect(() => {
    const unsubscribe = window.electron.onBloodborneSetupRequired(open);
    window.addEventListener(BLOODBORNE_SETUP_EVENT, open);
    return () => {
      unsubscribe();
      window.removeEventListener(BLOODBORNE_SETUP_EVENT, open);
    };
  }, [open]);

  useEffect(
    () => window.electron.onBloodbornePortProgress(setPortProgress),
    []
  );

  const downloadPort = async () => {
    setPortError(null);
    setPortProgress({ phase: "downloading", percent: 0 });
    try {
      await window.electron.downloadBloodbornePort();
      await open();
    } catch (err) {
      setPortError(err instanceof Error ? err.message : String(err));
    } finally {
      setPortProgress(null);
    }
  };

  const close = () => {
    setSetup(null);
    setSettings(null);
  };

  const update = (patch: Partial<BloodborneSettings>) =>
    setSettings((s) => (s ? { ...s, ...patch } : s));

  const browse = async () => {
    const dir = await window.electron.selectBloodborneGameDir();
    // null covers both a cancelled dialog and a folder without eboot.bin
    if (dir) {
      update({ eboot: dir });
      setError(false);
    }
  };

  const togglePatch = (patch: string, checked: boolean) =>
    update({
      enabledPatches: checked
        ? [...(settings?.enabledPatches ?? []), patch]
        : (settings?.enabledPatches ?? []).filter((p) => p !== patch),
    });

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await window.electron.saveBloodborneSetup(settings);
      window.dispatchEvent(new Event(BLOODBORNE_CONFIGURED_EVENT));
      close();
      await window.electron.openGame("custom", "bloodborne", "");
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  if (!setup || !settings) return null;

  if (!setup.portInstalled) {
    return (
      <Modal
        visible
        title={t("title")}
        description={t("port_missing")}
        onClose={close}
        clickOutsideToClose={false}
      >
        <div className="bloodborne-setup">
          {portError && (
            <span className="bloodborne-setup__error">
              {t("port_download_failed", { message: portError })}
            </span>
          )}
          <div className="bloodborne-setup__actions">
            <Button type="button" theme="outline" onClick={close}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={downloadPort}
              disabled={portProgress !== null}
            >
              {portProgress
                ? t(
                    portProgress.phase === "downloading"
                      ? "port_downloading"
                      : "port_extracting",
                    { percent: portProgress.percent }
                  )
                : t("download_port")}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  const { choices, upscalerSupport } = setup;
  const isSupported = (label: string) =>
    upscalerSupport[choices.upscalers[label]] !== false;

  return (
    <Modal
      visible
      title={t("title")}
      description={t("description")}
      onClose={close}
      clickOutsideToClose={false}
    >
      <div className="bloodborne-setup">
        <div className="bloodborne-setup__folder">
          <TextField
            label={t("game_folder")}
            value={settings.eboot}
            placeholder={t("game_folder_placeholder")}
            readOnly
          />
          <Button type="button" theme="outline" onClick={browse}>
            {t("browse")}
          </Button>
        </div>
        {error && (
          <span className="bloodborne-setup__error">{t("folder_invalid")}</span>
        )}

        <div className="bloodborne-setup__row">
          <SelectField
            label={t("frame_rate")}
            value={settings.fps}
            options={toOptions(choices.fps, (v) =>
              v === "uncap" ? t("frame_rate_uncap") : v
            )}
            onChange={(e) => update({ fps: e.target.value })}
          />
          <SelectField
            label={t("resolution")}
            value={settings.res}
            options={toOptions(choices.res)}
            onChange={(e) => update({ res: e.target.value })}
          />
          <SelectField
            label={t("window_mode")}
            value={settings.windowMode}
            options={toOptions(choices.windowMode)}
            onChange={(e) => update({ windowMode: e.target.value })}
          />
          <SelectField
            label={t("upscaler")}
            value={settings.upscaler}
            options={Object.keys(choices.upscalers).map((label) => ({
              key: label,
              value: label,
              label: isSupported(label)
                ? label
                : `${label} (${t("upscaler_unsupported")})`,
            }))}
            onChange={(e) => {
              if (isSupported(e.target.value))
                update({ upscaler: e.target.value });
            }}
          />
        </div>

        <div className="bloodborne-setup__patches">
          <span className="bloodborne-setup__hint">{t("patches")}</span>
          {choices.patches.map((patch) => (
            <CheckboxField
              key={patch}
              label={patch}
              checked={settings.enabledPatches.includes(patch)}
              onChange={(e) => togglePatch(patch, e.target.checked)}
            />
          ))}
        </div>

        <div className="bloodborne-setup__actions">
          <Button type="button" theme="outline" onClick={close}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={saving || !settings.eboot}
          >
            {t("save_and_play")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
