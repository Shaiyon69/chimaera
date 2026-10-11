import { useCallback, useEffect, useState } from "react";

import { Button } from "@renderer/components";
import type { LibraryGame } from "@types";

type Status = Awaited<ReturnType<typeof window.electron.getOptiscalerStatus>>;

const FSR4_LABEL = { live: "FSR4 live", loaded: "OptiScaler loaded" } as const;

export function OptiscalerSection({ game }: Readonly<{ game: LibraryGame }>) {
  const [status, setStatus] = useState<Status | null>(null);
  const [proxy, setProxy] = useState("dxgi.dll");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAnticheat, setConfirmAnticheat] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await window.electron.getOptiscalerStatus(
        game.shop,
        game.objectId
      );
      setStatus(s);
      setProxy(s.proxy ?? (s.api === "vulkan" ? "winmm.dll" : "dxgi.dll"));
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [game.shop, game.objectId]);

  useEffect(() => {
    void refresh();
  }, [refresh, game.executablePath]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setConfirmAnticheat(false);
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
    // Injecting into anti-cheat games can get the account banned: ask first.
    if (status?.anticheat && !confirmAnticheat) {
      setConfirmAnticheat(true);
      return;
    }
    void run(() =>
      window.electron.installOptiscaler(game.shop, game.objectId, proxy)
    );
  };

  if (!status && !error) return null;

  return (
    <div className="game-options-modal__optiscaler">
      <h3>OptiScaler + FSR4</h3>
      {status && (
        <>
          <p>
            {status.installed
              ? `Installed ${status.version} (${status.proxy})`
              : "Not installed"}
            {status.loaded ? ` · ${FSR4_LABEL[status.loaded]}` : ""}
            {` · API: ${status.api}`}
          </p>
          <select
            value={proxy}
            disabled={busy}
            onChange={(e) => setProxy(e.target.value)}
          >
            {status.proxies.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {confirmAnticheat && (
            <p>
              Anti-cheat detected ({status.anticheat}). Injecting a DLL can get
              you banned or crash the game. Click again to continue.
            </p>
          )}
          <Button theme="primary" disabled={busy} onClick={install}>
            {status.installed ? "Update" : "Install"}
          </Button>
          {status.installed && (
            <Button
              theme="danger"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  window.electron.uninstallOptiscaler(game.shop, game.objectId)
                )
              }
            >
              Uninstall
            </Button>
          )}
        </>
      )}
      {error && <p>{error}</p>}
    </div>
  );
}
