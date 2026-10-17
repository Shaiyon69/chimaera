import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Modal } from "../modal/modal";
import { Button } from "../button/button";
import { BLOODBORNE_CONFIGURED_EVENT, BLOODBORNE_SETUP_EVENT } from "./events";

import "./bloodborne-setup-modal.scss";

/** Offers the port download; the port's own launcher handles everything after that. */
export function BloodborneSetupModal() {
  const { t } = useTranslation("bloodborne_setup");
  const [visible, setVisible] = useState(false);
  const [portProgress, setPortProgress] = useState<{
    phase: "downloading" | "extracting";
    percent: number;
  } | null>(null);
  const [portError, setPortError] = useState<string | null>(null);

  const open = useCallback(async () => {
    const { portInstalled } = await window.electron.getBloodborneSetup();
    if (portInstalled) {
      await window.electron.openGame("custom", "bloodborne", "");
      return;
    }
    setPortError(null);
    setVisible(true);
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
      window.dispatchEvent(new Event(BLOODBORNE_CONFIGURED_EVENT));
      setVisible(false);
      await window.electron.openGame("custom", "bloodborne", "");
    } catch (err) {
      setPortError(err instanceof Error ? err.message : String(err));
    } finally {
      setPortProgress(null);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible
      title={t("title")}
      description={t("port_missing")}
      onClose={() => setVisible(false)}
      clickOutsideToClose={false}
    >
      <div className="bloodborne-setup">
        {portError && (
          <span className="bloodborne-setup__error">
            {t("port_download_failed", { message: portError })}
          </span>
        )}
        <div className="bloodborne-setup__actions">
          <Button
            type="button"
            theme="outline"
            onClick={() => setVisible(false)}
          >
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
