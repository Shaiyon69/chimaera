import { useId } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tooltip } from "react-tooltip";
import cn from "classnames";

import { useUserDetails } from "@renderer/hooks";
import { routes } from "../sidebar/routes";
import { SidebarProfile } from "../sidebar/sidebar-profile";
import "./nav-dock.scss";

export function NavDock() {
  const { t } = useTranslation("sidebar");
  const location = useLocation();
  const navigate = useNavigate();
  const tooltipId = useId();
  const { userDetails } = useUserDetails();

  return (
    <nav className="nav-dock">
      <SidebarProfile />
      {routes
        .filter(({ requiresAuth }) => !requiresAuth || userDetails)
        .map(({ nameKey, path, render }) => (
          <button
            key={nameKey}
            type="button"
            aria-label={t(nameKey)}
            data-tooltip-id={tooltipId}
            data-tooltip-content={t(nameKey)}
            className={cn("nav-dock__button", {
              "nav-dock__button--active": location.pathname === path,
            })}
            onClick={() => {
              if (path !== location.pathname) navigate(path);
            }}
          >
            {render()}
          </button>
        ))}
      <Tooltip id={tooltipId} place="left" />
    </nav>
  );
}
