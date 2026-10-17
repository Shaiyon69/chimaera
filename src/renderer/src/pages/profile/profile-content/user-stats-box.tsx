import { useCallback, useContext } from "react";
import { userProfileContext } from "@renderer/context";
import { useTranslation } from "react-i18next";
import { useFormat } from "@renderer/hooks";
import { MAX_MINUTES_TO_SHOW_IN_PLAYTIME } from "@renderer/constants";
import { ClockIcon, TrophyIcon } from "@primer/octicons-react";
import "./user-stats-box.scss";

export function UserStatsBox() {
  const { userStats } = useContext(userProfileContext);
  const { t } = useTranslation("user_profile");
  const { numberFormatter } = useFormat();

  const formatPlayTime = useCallback(
    (playTimeInSeconds: number) => {
      const minutes = playTimeInSeconds / 60;

      if (minutes < MAX_MINUTES_TO_SHOW_IN_PLAYTIME) {
        return t("amount_minutes", {
          amount: minutes.toFixed(0),
        });
      }

      const hours = minutes / 60;
      return t("amount_hours", { amount: numberFormatter.format(hours) });
    },
    [numberFormatter, t]
  );

  if (!userStats) return null;

  return (
    <div className="user-stats__box">
      <ul className="user-stats__list">
        <li className="user-stats__list-item">
          <h3 className="user-stats__list-title">
            {t("achievements_unlocked")}
          </h3>
          <div className="user-stats__stats-row">
            <p className="user-stats__list-description">
              <TrophyIcon /> {userStats.unlockedAchievementSum ?? 0}{" "}
              {t("achievements")}
            </p>
          </div>
        </li>

        <li className="user-stats__list-item">
          <h3 className="user-stats__list-title">{t("total_play_time")}</h3>
          <div className="user-stats__stats-row">
            <p className="user-stats__list-description">
              <ClockIcon />
              {formatPlayTime(userStats.totalPlayTimeInSeconds.value)}
            </p>
          </div>
        </li>
      </ul>
    </div>
  );
}
