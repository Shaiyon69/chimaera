import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@renderer/components";
import type { LibraryGame } from "@types";

import { OptiscalerConfig } from "./optiscaler-config";

type Status = Awaited<ReturnType<typeof window.electron.getOptiscalerStatus>>;
type Confirm = "install" | "uninstall" | null;

export function OptiscalerSection({ game }: Readonly<{ game: LibraryGame }>) {
  const { t } = useTranslation("game_details");
  const [status, setStatus] = useState<Status | null>(null);
  const [proxy, setProxy] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await window.electron.getOptiscalerStatus(
        game.shop,
        game.objectId,
        proxy ?? undefined
      );
      setStatus(s);
      setProxy(
        (current) =>
          current ?? s.proxy ?? (s.api === "vulkan" ? "winmm.dll" : "dxgi.dll")
      );
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [game.shop, game.objectId, proxy]);

  useEffect(() => {
    void refresh();
  }, [refresh, game.executablePath]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setConfirm(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const install = () => {
    // Anti-cheat injection can get the account banned; a foreign proxy DLL gets moved to backup: ask first.
    if ((status?.anticheat || status?.proxyConflict) && confirm !== "install") {
      setConfirm("install");
      return;
    }
    void run(() =>
      window.electron.installOptiscaler(
        game.shop,
        game.objectId,
        proxy ?? "dxgi.dll"
      )
    );
  };

  const uninstall = () => {
    if (confirm !== "uninstall") {
      setConfirm("uninstall");
      return;
    }
    void run(() =>
      window.electron.uninstallOptiscaler(game.shop, game.objectId)
    );
  };

  if (!status && !error) return null;

  let installLabel = t("optiscaler_install");
  if (status?.installed)
    installLabel = status.updateAvailable
      ? t("optiscaler_update", { version: status.latestTag })
      : t("optiscaler_reinstall");

  return (
    <div className="game-options-modal__optiscaler">
      <h3>{t("optiscaler_title")}</h3>
      {status && (
        <>
          <p>
            {status.installed
              ? t("optiscaler_installed", {
                  version: status.version,
                  proxy: status.proxy,
                })
              : t("optiscaler_not_installed")}
            {status.loaded
              ? ` · ${t(status.loaded === "live" ? "optiscaler_fsr4_live" : "optiscaler_loaded")}`
              : ""}
            {` · ${t("optiscaler_api", { api: status.api })}`}
          </p>
          <select
            value={proxy ?? ""}
            disabled={busy}
            onChange={(e) => {
              setProxy(e.target.value);
              setConfirm(null);
            }}
          >
            {status.proxies.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {!status.fsr4Available && <p>{t("optiscaler_no_fsr4")}</p>}
          {confirm === "install" && status.anticheat && (
            <p>
              {t("optiscaler_anticheat_warning", { name: status.anticheat })}
            </p>
          )}
          {confirm === "install" && status.proxyConflict && (
            <p>
              {t("optiscaler_proxy_conflict_warning", {
                proxy: status.proxyConflict,
              })}
            </p>
          )}
          {confirm === "uninstall" && (
            <p>{t("optiscaler_uninstall_confirm")}</p>
          )}
          <Button theme="primary" disabled={busy} onClick={install}>
            {installLabel}
          </Button>
          {status.installed && (
            <Button theme="danger" disabled={busy} onClick={uninstall}>
              {t("optiscaler_uninstall")}
            </Button>
          )}
        </>
      )}
      {status?.installed && !busy && <OptiscalerConfig game={game} />}
      {error && <p>{error}</p>}
    </div>
  );
}
