import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { CheckboxField, SelectField, TextField } from "@renderer/components";
import type { LibraryGame } from "@types";

type Field = Awaited<
  ReturnType<typeof window.electron.getOptiscalerConfig>
>[number];

export function OptiscalerConfig({
  game,
  native,
}: Readonly<{ game: LibraryGame; native: boolean }>) {
  const { t } = useTranslation("game_details");
  const [fields, setFields] = useState<Field[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setFields(
        await window.electron.getOptiscalerConfig(game.shop, game.objectId)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [game.shop, game.objectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (key: string, value: string) => {
    setError(null);
    try {
      await window.electron.setOptiscalerConfig(
        game.shop,
        game.objectId,
        key,
        value
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    void load();
  };

  if (!fields.length && !error) return null;

  return (
    <div className="optiscaler__config">
      <h4>{t("optiscaler_config_title")}</h4>
      <div className="optiscaler__config-grid">
        {fields
          // RDNA4 runs FSR4 natively, so the INT8 fallback is meaningless there.
          .filter((f) => !(native && f.key === "Fsr4ForceEnableInt8"))
          .map((field) => {
            const label = t(`optiscaler_cfg_${field.key}`);
            if (field.type === "toggle")
              return (
                <CheckboxField
                  key={field.key}
                  label={label}
                  checked={field.value.toLowerCase() === "true"}
                  onChange={(e) =>
                    void save(field.key, String(e.target.checked))
                  }
                />
              );
            if (field.type === "select")
              return (
                <SelectField
                  key={field.key}
                  label={label}
                  value={field.value}
                  options={field.options.map((o) => ({
                    key: o,
                    value: o,
                    label: o,
                  }))}
                  onChange={(e) => void save(field.key, e.target.value)}
                />
              );
            return (
              <TextField
                key={field.key}
                label={label}
                type="number"
                theme="dark"
                min={field.min}
                max={field.max}
                step={0.1}
                defaultValue={field.value}
                onBlur={(e) => {
                  if (e.target.value !== field.value)
                    void save(field.key, e.target.value);
                }}
              />
            );
          })}
      </div>
      {error && <p className="optiscaler__error">{error}</p>}
    </div>
  );
}
