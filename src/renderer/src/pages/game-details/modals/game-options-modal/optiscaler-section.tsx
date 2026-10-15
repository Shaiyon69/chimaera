import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge, Button, SelectField } from "@renderer/components";
import type { LibraryGame } from "@types";

import { OptiscalerConfig } from "./optiscaler-config";

import "./optiscaler-section.scss";

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

  const fsr4Label =
    status?.fsr4Gpu === "native"
      ? t("optiscaler_fsr4_native")
      : t("optiscaler_fsr4_lite", {
          gpu: t(`optiscaler_gpu_${status?.fsr4Gpu ?? "desktop"}`),
          variant: t(`optiscaler_fsr4_${status?.fsr4Variant ?? "exact"}`, {
            ns: "settings",
          }),
        });

  return (
    <div className="optiscaler">
      <h3>{t("optiscaler_title")}</h3>
      {status && (
        <>
          <div className="optiscaler__badges">
            <Badge>
              {status.installed
                ? t("optiscaler_installed", {
                    version: status.version,
                    proxy: status.proxy,
                  })
                : t("optiscaler_not_installed")}
            </Badge>
            <Badge>{t("optiscaler_api", { api: status.api })}</Badge>
            <Badge>{fsr4Label}</Badge>
            {status.loaded && (
              <Badge>
                {t(
                  status.loaded === "live"
                    ? "optiscaler_fsr4_live"
                    : "optiscaler_loaded"
                )}
              </Badge>
            )}
          </div>
          <SelectField
            label={t("optiscaler_proxy_label")}
            value={proxy ?? ""}
            disabled={busy}
            options={status.proxies.map((p) => ({
              key: p,
              value: p,
              label: p,
            }))}
            onChange={(e) => {
              setProxy(e.target.value);
              setConfirm(null);
            }}
          />
          {!status.fsr4Available && (
            <p className="optiscaler__warning">{t("optiscaler_no_fsr4")}</p>
          )}
          {confirm === "install" && status.anticheat && (
            <p className="optiscaler__warning">
              {t("optiscaler_anticheat_warning", { name: status.anticheat })}
            </p>
          )}
          {confirm === "install" && status.proxyConflict && (
            <p className="optiscaler__warning">
              {t("optiscaler_proxy_conflict_warning", {
                proxy: status.proxyConflict,
              })}
            </p>
          )}
          {confirm === "uninstall" && (
            <p className="optiscaler__warning">
              {t("optiscaler_uninstall_confirm")}
            </p>
          )}
          <div className="optiscaler__actions">
            <Button theme="primary" disabled={busy} onClick={install}>
              {installLabel}
            </Button>
            {status.installed && (
              <Button theme="danger" disabled={busy} onClick={uninstall}>
                {t("optiscaler_uninstall")}
              </Button>
            )}
          </div>
        </>
      )}
      {status?.installed && !busy && (
        <OptiscalerConfig game={game} native={status.fsr4Gpu === "native"} />
      )}
      {error && <p className="optiscaler__error">{error}</p>}
    </div>
  );
}
