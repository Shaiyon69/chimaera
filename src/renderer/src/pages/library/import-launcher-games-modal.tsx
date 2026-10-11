import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, CheckboxField, Modal } from "@renderer/components";
import { logger } from "@renderer/logger";
import type { DetectedLauncherGame } from "@types";

import "./import-launcher-games-modal.scss";

interface ImportLauncherGamesModalProps {
  visible: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function ImportLauncherGamesModal({
  visible,
  onClose,
  onImported,
}: Readonly<ImportLauncherGamesModalProps>) {
  const { t } = useTranslation("library");
  const [games, setGames] = useState<DetectedLauncherGame[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setGames(null);
    setError(null);
    window.electron
      .detectLauncherGames()
      .then((detected) => {
        setGames(detected);
        setSelected(
          new Set(detected.filter((g) => !g.imported).map((g) => g.objectId))
        );
      })
      .catch((err) => {
        logger.error("Failed to detect launcher games", err);
        setGames([]);
        setError(t("import_launcher_games_failed"));
      });
  }, [visible, t]);

  const byLauncher = useMemo(() => {
    const groups = new Map<
      DetectedLauncherGame["launcher"],
      DetectedLauncherGame[]
    >();
    for (const game of games ?? []) {
      groups.set(game.launcher, [...(groups.get(game.launcher) ?? []), game]);
    }
    return [...groups.entries()];
  }, [games]);

  const toggle = (objectId: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(objectId)) next.add(objectId);
      return next;
    });

  const handleImport = async () => {
    setBusy(true);
    setError(null);
    try {
      await window.electron.importLauncherGames(
        (games ?? [])
          .filter((g) => selected.has(g.objectId))
          .map(({ launcher, id }) => ({ launcher, id }))
      );
      onImported();
      onClose();
    } catch (err) {
      logger.error("Failed to import launcher games", err);
      setError(t("import_launcher_games_failed"));
    } finally {
      setBusy(false);
    }
  };

  let body: React.ReactNode;
  if (games === null) {
    body = <p>{t("import_launcher_games_scanning")}</p>;
  } else if (!games.length) {
    body = <p>{t("import_launcher_games_none")}</p>;
  } else {
    body = byLauncher.map(([launcher, list]) => (
      <div key={launcher} className="import-launcher-games__group">
        <h4>{t(`launcher_${launcher}`)}</h4>
        {list.map((game) => (
          <CheckboxField
            key={game.objectId}
            label={
              game.imported
                ? `${game.title} (${t("import_launcher_games_already")})`
                : game.title
            }
            checked={game.imported || selected.has(game.objectId)}
            disabled={game.imported || busy}
            onChange={() => toggle(game.objectId)}
          />
        ))}
      </div>
    ));
  }

  return (
    <Modal
      visible={visible}
      title={t("import_launcher_games_title")}
      onClose={onClose}
    >
      <div className="import-launcher-games">
        {body}
        {error && <p>{error}</p>}
        <Button
          theme="primary"
          disabled={busy || !selected.size}
          onClick={() => void handleImport()}
        >
          {t("import_launcher_games_confirm", { count: selected.size })}
        </Button>
      </div>
    </Modal>
  );
}
