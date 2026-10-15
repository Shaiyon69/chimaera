import { useTranslation } from "react-i18next";
import "./traffic-lights.scss";

interface TrafficLightsProps {
  isMaximized?: boolean;
}

export function TrafficLights({ isMaximized = false }: TrafficLightsProps) {
  const { t } = useTranslation("header");
  const maximizeLabel = isMaximized ? t("restore") : t("maximize");

  return (
    <div className="traffic-lights">
      <button
        type="button"
        className="traffic-lights__min"
        title={t("minimize")}
        aria-label={t("minimize")}
        onClick={() => window.electron.minimizeMainWindow()}
      />
      <button
        type="button"
        className="traffic-lights__max"
        title={maximizeLabel}
        aria-label={maximizeLabel}
        onClick={() => window.electron.toggleMaximizeMainWindow()}
      />
      <button
        type="button"
        className="traffic-lights__close"
        title={t("close")}
        aria-label={t("close")}
        onClick={() => window.electron.closeMainWindow()}
      />
    </div>
  );
}
