import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryGame } from "@types";

type Field = Awaited<
  ReturnType<typeof window.electron.getOptiscalerConfig>
>[number];

export function OptiscalerConfig({ game }: Readonly<{ game: LibraryGame }>) {
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
    <div className="game-options-modal__optiscaler-config">
      <h4>{t("optiscaler_config_title")}</h4>
      {fields.map((field) => (
        <label key={field.key}>
          {t(`optiscaler_cfg_${field.key}`)}
          {field.type === "toggle" && (
            <input
              type="checkbox"
              checked={field.value.toLowerCase() === "true"}
              onChange={(e) => void save(field.key, String(e.target.checked))}
            />
          )}
          {field.type === "select" && (
            <select
              value={field.value}
              onChange={(e) => void save(field.key, e.target.value)}
            >
              {field.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          )}
          {field.type === "number" && (
            <input
              type="number"
              min={field.min}
              max={field.max}
              step={0.1}
              defaultValue={field.value}
              onBlur={(e) => {
                if (e.target.value !== field.value)
                  void save(field.key, e.target.value);
              }}
            />
          )}
        </label>
      ))}
      {error && <p>{error}</p>}
    </div>
  );
}
