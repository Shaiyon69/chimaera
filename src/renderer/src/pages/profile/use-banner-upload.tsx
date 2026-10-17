import { ConfirmationModal } from "@renderer/components";
import { useContext, useState } from "react";
import { userProfileContext } from "@renderer/context";
import { useToast, useUserDetails } from "@renderer/hooks";
import { useTranslation } from "react-i18next";
import { getProfileImageMetadata } from "./profile-image-metadata";
import { ProfileImageCropModal } from "./profile-image-crop-modal/profile-image-crop-modal";

export function useBannerUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [bannerImageToCrop, setBannerImageToCrop] = useState<string | null>(
    null
  );
  const [cropIsAnimated, setCropIsAnimated] = useState(false);

  const { t } = useTranslation("user_profile");

  const { setSelectedBackgroundImage, userProfile, getUserProfile } =
    useContext(userProfileContext);
  const { patchUser, fetchUserDetails } = useUserDetails();
  const { showSuccessToast, showErrorToast } = useToast();

  const hasBanner = !!userProfile?.backgroundImageUrl;

  const uploadBanner = async (path: string) => {
    try {
      setSelectedBackgroundImage(path);
      setIsUploading(true);

      await patchUser({ backgroundImageUrl: path });

      showSuccessToast(t("background_image_updated"));
      await fetchUserDetails();
      await getUserProfile();
    } catch {
      showErrorToast(t("try_again"));
    } finally {
      setIsUploading(false);
    }
  };

  const replaceBanner = async () => {
    if (isUploading) return;

    const { filePaths } = await window.electron.showOpenDialog({
      properties: ["openFile"],
      filters: [
        {
          name: "Image",
          extensions: ["jpg", "jpeg", "png", "apng", "gif", "webp"],
        },
      ],
    });

    if (filePaths && filePaths.length > 0) {
      const path = filePaths[0];
      const metadata = await getProfileImageMetadata(path);

      // Animated banners are cropped in main/sharp so the animation survives.
      setCropIsAnimated(metadata.isAnimated);
      setBannerImageToCrop(path);
    }
  };

  const removeBanner = async () => {
    setShowRemoveModal(false);
    try {
      setIsUploading(true);
      setSelectedBackgroundImage("");
      await patchUser({ backgroundImageUrl: null });
      showSuccessToast(t("background_image_updated"));
      await fetchUserDetails();
      await getUserProfile();
    } finally {
      setIsUploading(false);
    }
  };

  const modals = (
    <>
      <ProfileImageCropModal
        visible={!!bannerImageToCrop}
        imagePath={bannerImageToCrop}
        variant="banner"
        isAnimated={cropIsAnimated}
        onClose={() => setBannerImageToCrop(null)}
        onApply={(croppedImagePath) => {
          setBannerImageToCrop(null);
          uploadBanner(croppedImagePath);
        }}
      />
      <ConfirmationModal
        visible={showRemoveModal}
        title={t("remove_banner_modal_title")}
        descriptionText={t("remove_banner_confirmation")}
        onClose={() => setShowRemoveModal(false)}
        onConfirm={removeBanner}
        cancelButtonLabel={t("cancel")}
        confirmButtonLabel={t("remove")}
        buttonsIsDisabled={isUploading}
      />
    </>
  );

  return {
    hasBanner,
    isUploading,
    replaceBanner,
    requestRemoveBanner: () => setShowRemoveModal(true),
    modals,
  };
}
