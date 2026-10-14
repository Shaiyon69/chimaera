import { useContext } from "react";
import { useTranslation } from "react-i18next";

import { Button, CheckboxField, TextField } from "@renderer/components";
import { settingsContext } from "@renderer/context";
import { useAppSelector } from "@renderer/hooks";

import "./settings-optiscaler.scss";

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
    <div className="settings-optiscaler">
      <section className="settings-optiscaler__card">
        <CheckboxField
          label={t("optiscaler_nightly")}
          checked={prefs?.optiscalerNightly ?? false}
          onChange={() =>
            void updateUserPreferences({
              optiscalerNightly: !(prefs?.optiscalerNightly ?? false),
            })
          }
        />
      </section>

      <section className="settings-optiscaler__card">
        <div className="settings-optiscaler__card-header">
          <h3 className="settings-optiscaler__card-title">
            {t("optiscaler_fsr4_dlls")}
          </h3>
          <p className="settings-optiscaler__hint">
            {t("optiscaler_fsr4_hint")}
          </p>
        </div>
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
      </section>

      <section className="settings-optiscaler__card">
        <h3 className="settings-optiscaler__card-title">
          {t("optiscaler_fsr4_variant")}
        </h3>
        <div className="settings-optiscaler__variant" role="radiogroup">
          {(["exact", "lossy"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={variant === v}
              className={`settings-optiscaler__variant-option${
                variant === v
                  ? " settings-optiscaler__variant-option--active"
                  : ""
              }`}
              onClick={() =>
                void updateUserPreferences({ optiscalerFsr4Variant: v })
              }
            >
              {t(`optiscaler_fsr4_${v}`)}
            </button>
          ))}
        </div>
        {variant === "lossy" && (
          <p className="settings-optiscaler__warning">
            {t("optiscaler_fsr4_lossy_warning")}
          </p>
        )}
      </section>
    </div>
  );
}
