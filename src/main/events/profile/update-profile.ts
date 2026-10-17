import { registerEvent } from "../register-event";
import { HydraApi, WindowManager } from "@main/services";
import { SystemPath } from "@main/services/system-path";
import fs from "node:fs";
import path from "node:path";
import type { UpdateProfileRequest, UserProfile } from "@types";
import { omit } from "lodash-es";
import { fileTypeFromFile } from "file-type";

export const patchUserProfile = async (updateProfile: UpdateProfileRequest) => {
  return HydraApi.patch<UserProfile>("/profile", updateProfile);
};

/** Keeps the picked image in app data (no Hydra upload) and returns its `local:` URL. */
const uploadImage = async (
  type: "profile-image" | "background-image",
  imagePath: string
) => {
  const mimeType = await fileTypeFromFile(imagePath);
  if (!mimeType?.mime.startsWith("image/"))
    throw new Error("profile/not-an-image");
  const dir = path.join(SystemPath.getPath("userData"), "local-profile");
  fs.mkdirSync(dir, { recursive: true });
  // A new name each time, so the renderer does not show a cached old picture.
  const target = path.join(dir, `${type}-${Date.now()}.${mimeType.ext}`);
  await fs.promises.copyFile(imagePath, target);
  return `local:${target}`;
};

const updateProfile = async (
  _event: Electron.IpcMainInvokeEvent,
  updateProfile: UpdateProfileRequest
) => {
  const payload = omit(updateProfile, [
    "profileImageUrl",
    "backgroundImageUrl",
  ]);

  if (updateProfile.profileImageUrl !== undefined) {
    if (updateProfile.profileImageUrl === null) {
      payload["profileImageUrl"] = null;
    } else {
      const profileImageUrl = await uploadImage(
        "profile-image",
        updateProfile.profileImageUrl
      ).catch(() => undefined);

      payload["profileImageUrl"] = profileImageUrl;
    }
  }

  if (updateProfile.backgroundImageUrl !== undefined) {
    if (updateProfile.backgroundImageUrl === null) {
      payload["backgroundImageUrl"] = null;
    } else {
      const backgroundImageUrl = await uploadImage(
        "background-image",
        updateProfile.backgroundImageUrl
      ).catch(() => undefined);

      payload["backgroundImageUrl"] = backgroundImageUrl;
    }
  }

  const updatedProfile = await patchUserProfile(payload);

  // Notify every window (e.g. the friends window, which has its own store) so
  // they can re-fetch the signed-in user's details after a profile change.
  WindowManager.sendToAppWindows("on-profile-updated");

  return updatedProfile;
};

registerEvent("updateProfile", updateProfile);
