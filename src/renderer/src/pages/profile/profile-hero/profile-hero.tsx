import { useCallback, useContext, useMemo, useState } from "react";
import { userProfileContext } from "@renderer/context";
import { buildGameDetailsPath } from "@renderer/helpers";
import { Avatar, FullscreenMediaModal, Link } from "@renderer/components";
import { useTranslation } from "react-i18next";
import { useAppSelector, useDate } from "@renderer/hooks";
import { addSeconds } from "date-fns";

import { GameVisibilityBadge } from "@renderer/components/game-visibility-badge/game-visibility-badge";

import { EditProfileModal } from "../edit-profile-modal/edit-profile-modal";
import Skeleton from "react-loading-skeleton";
import { useBannerUpload } from "../use-banner-upload";
import "./profile-hero.scss";

export function ProfileHero() {
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showFullscreenAvatar, setShowFullscreenAvatar] = useState(false);

  const { isMe, userProfile, heroBackground, backgroundImage } =
    useContext(userProfileContext);

  const { gameRunning } = useAppSelector((state) => state.gameRunning);

  const { t } = useTranslation("user_profile");
  const { formatDistance } = useDate();

  const { replaceBanner, modals: bannerModals } = useBannerUpload();

  const handleAvatarClick = useCallback(() => {
    if (isMe) {
      setShowEditProfileModal(true);
    } else if (userProfile?.profileImageUrl) {
      setShowFullscreenAvatar(true);
    }
  }, [isMe, userProfile?.profileImageUrl]);

  const currentGame = useMemo(() => {
    if (isMe) {
      if (gameRunning)
        return {
          ...gameRunning,
          objectId: gameRunning.objectId,
          sessionDurationInSeconds: gameRunning.sessionDurationInMillis / 1000,
        };

      return null;
    }
    return userProfile?.currentGame;
  }, [isMe, userProfile, gameRunning]);

  return (
    <>
      <EditProfileModal
        visible={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
      />

      {isMe && bannerModals}

      <FullscreenMediaModal
        visible={showFullscreenAvatar}
        onClose={() => setShowFullscreenAvatar(false)}
        src={userProfile?.profileImageUrl}
        alt={userProfile?.displayName}
      />

      <section
        className="profile-hero__content-box"
        style={{ background: !backgroundImage ? heroBackground : undefined }}
      >
        {backgroundImage && (
          <img
            src={backgroundImage}
            alt=""
            className="profile-hero__background-image"
          />
        )}

        {isMe && (
          <button
            type="button"
            className="profile-hero__banner-button"
            onClick={replaceBanner}
            aria-label={t("change_banner")}
          />
        )}

        <div
          className={`profile-hero__background-overlay ${
            !backgroundImage
              ? "profile-hero__background-overlay--transparent"
              : ""
          }`}
        >
          <div className="profile-hero__user-information">
            <button
              type="button"
              className="profile-hero__avatar-button"
              onClick={handleAvatarClick}
            >
              <Avatar
                size={96}
                alt={userProfile?.displayName}
                src={userProfile?.profileImageUrl}
              />
            </button>

            <div className="profile-hero__information">
              {userProfile ? (
                <div className="profile-hero__display-name-container">
                  <h2 className="profile-hero__display-name">
                    {userProfile?.displayName}
                  </h2>
                </div>
              ) : (
                <Skeleton width={150} height={28} />
              )}

              {currentGame && (
                <div className="profile-hero__current-game-wrapper">
                  <div className="profile-hero__current-game-details">
                    <Link
                      to={buildGameDetailsPath({
                        ...currentGame,
                        objectId: currentGame.objectId,
                      })}
                    >
                      {currentGame.title}
                    </Link>
                    <GameVisibilityBadge
                      isHiddenFromOthers={
                        "isHiddenFromOthers" in currentGame &&
                        currentGame.isHiddenFromOthers === true
                      }
                    />
                  </div>

                  <small>
                    {t("playing_for", {
                      amount: formatDistance(
                        addSeconds(
                          new Date(),
                          -currentGame.sessionDurationInSeconds
                        ),
                        new Date()
                      ),
                    })}
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
