import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownIcon, ArrowUpIcon } from "@primer/octicons-react";

import { Button, CheckboxField } from "@renderer/components";

import "./bloodborne-mods-section.scss";

export function BloodborneModsSection() {
  const { t } = useTranslation("game_details");
  const [state, setState] = useState<BloodborneModsState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const refresh = useCallback(
    () => window.electron.getBloodborneMods().then(setState),
    []
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setConfirmRemove(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const save = (next: BloodborneModsState) => {
    setState(next);
    void run(() => window.electron.saveBloodborneMods(next));
  };

  const move = (index: number, by: -1 | 1) => {
    if (!state) return;
    const mods = [...state.mods];
    [mods[index], mods[index + by]] = [mods[index + by], mods[index]];
    save({ ...state, mods });
  };

  const toggle = (index: number, enabled: boolean) => {
    if (!state) return;
    save({
      ...state,
      mods: state.mods.map((m, i) => (i === index ? { ...m, enabled } : m)),
    });
  };

  const remove = (name: string) => {
    if (confirmRemove !== name) {
      setConfirmRemove(name);
      return;
    }
    void run(() => window.electron.removeBloodborneMod(name));
  };

  if (!state) return null;

  return (
    <div className="bloodborne-mods">
      <h3>{t("bloodborne_mods_title")}</h3>
      <p>{t("bloodborne_mods_hint")}</p>
      <CheckboxField
        label={t("bloodborne_mods_enable")}
        checked={state.enabled}
        disabled={busy}
        onChange={(e) => save({ ...state, enabled: e.target.checked })}
      />

      {state.mods.length === 0 && <p>{t("bloodborne_mods_empty")}</p>}
      <ul className="bloodborne-mods__list">
        {state.mods.map((mod, index) => (
          <li key={mod.name} className="bloodborne-mods__row">
            <CheckboxField
              label={mod.name}
              checked={mod.enabled}
              disabled={busy || !state.enabled}
              onChange={(e) => toggle(index, e.target.checked)}
            />
            <Button
              theme="outline"
              disabled={busy || index === 0}
              onClick={() => move(index, -1)}
              aria-label={t("bloodborne_mods_move_up", { name: mod.name })}
            >
              <ArrowUpIcon />
            </Button>
            <Button
              theme="outline"
              disabled={busy || index === state.mods.length - 1}
              onClick={() => move(index, 1)}
              aria-label={t("bloodborne_mods_move_down", { name: mod.name })}
            >
              <ArrowDownIcon />
            </Button>
            <Button
              theme="danger"
              disabled={busy}
              onClick={() => remove(mod.name)}
            >
              {confirmRemove === mod.name
                ? t("bloodborne_mods_remove_confirm")
                : t("bloodborne_mods_remove")}
            </Button>
          </li>
        ))}
      </ul>

      {error && <p className="bloodborne-mods__error">{error}</p>}

      <div className="bloodborne-mods__actions">
        <Button
          theme="primary"
          disabled={busy}
          onClick={() =>
            void run(() => window.electron.addBloodborneMod("folder"))
          }
        >
          {t("bloodborne_mods_add_folder")}
        </Button>
        <Button
          theme="outline"
          disabled={busy}
          onClick={() =>
            void run(() => window.electron.addBloodborneMod("archive"))
          }
        >
          {t("bloodborne_mods_add_archive")}
        </Button>
        <Button
          theme="outline"
          disabled={busy}
          onClick={() =>
            void run(() => window.electron.openBloodborneModsFolder())
          }
        >
          {t("bloodborne_mods_open_folder")}
        </Button>
      </div>
    </div>
  );
}
