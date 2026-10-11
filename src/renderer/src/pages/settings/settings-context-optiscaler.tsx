import { useContext } from "react";
import { useTranslation } from "react-i18next";

import { Button, CheckboxField, TextField } from "@renderer/components";
import { settingsContext } from "@renderer/context";
import { useAppSelector } from "@renderer/hooks";

import "./settings-behavior.scss";
import "./settings-general.scss";

type DllKey = "optiscalerFsr4ExactPath" | "optiscalerFsr4LossyPath";

export function SettingsContextOptiscaler() {
  const { t } = useTranslation("settings");
  const { updateUserPreferences } = useContext(settingsContext);
  const prefs = useAppSelector((state) => state.userPreferences.value);

  const variant = prefs?.optiscalerFsr4Variant ?? "exact";
  const exactPath =
    prefs?.optiscalerFsr4ExactPath ?? prefs?.optiscalerFsr4DllPath ?? "";
  const lossyPath = prefs?.optiscalerFsr4LossyPath ?? "";

  const chooseDll = async (key: DllKey) => {
    const { filePaths } = await window.electron.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "DLL", extensions: ["dll"] }],
    });
    if (!filePaths.length) return;
    await updateUserPreferences({ [key]: filePaths[0] });
  };

  const dllField = (key: DllKey, label: string, value: string) => (
    <TextField
      label={label}
      value={value}
      readOnly
      theme="dark"
      rightContent={
        <>
          <Button type="button" onClick={() => void chooseDll(key)}>
            {t("optiscaler_fsr4_choose")}
          </Button>
          <Button
            type="button"
            theme="outline"
            disabled={!value}
            onClick={() =>
              void updateUserPreferences(
                key === "optiscalerFsr4ExactPath"
                  ? { [key]: null, optiscalerFsr4DllPath: null }
                  : { [key]: null }
              )
            }
          >
            {t("optiscaler_fsr4_clear")}
          </Button>
        </>
      }
    />
  );

  return (
    <div className="settings-context-panel">
      <div className="settings-context-panel__group">
        <CheckboxField
          label={t("optiscaler_nightly")}
          checked={prefs?.optiscalerNightly ?? false}
          onChange={() =>
            void updateUserPreferences({
              optiscalerNightly: !(prefs?.optiscalerNightly ?? false),
            })
          }
        />

        <p>{t("optiscaler_fsr4_hint")}</p>
        {dllField(
          "optiscalerFsr4ExactPath",
          t("optiscaler_fsr4_exact_path"),
          exactPath
        )}
        {dllField(
          "optiscalerFsr4LossyPath",
          t("optiscaler_fsr4_lossy_path"),
          lossyPath
        )}

        <label>
          {t("optiscaler_fsr4_variant")}
          <select
            value={variant}
            onChange={(e) =>
              void updateUserPreferences({
                optiscalerFsr4Variant: e.target.value as "exact" | "lossy",
              })
            }
          >
            <option value="exact">{t("optiscaler_fsr4_exact")}</option>
            <option value="lossy">{t("optiscaler_fsr4_lossy")}</option>
          </select>
        </label>
        {variant === "lossy" && <p>{t("optiscaler_fsr4_lossy_warning")}</p>}
      </div>
    </div>
  );
}
