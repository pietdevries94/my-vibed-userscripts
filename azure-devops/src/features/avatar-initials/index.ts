import type { Feature } from "../../core/feature.ts";
import { showInitialsOnAvatars } from "../../pull-requests/avatars.ts";
import style from "./style.css";

const avatarInitials: Feature = {
  description: "Initials on avatars, in a colour per person.",
  // The key of the earlier menu setting, so the owner's choice stays.
  id: "avatar-initials",
  name: "Avatar initials",
  start: ({ document }) => ({
    sync() {
      showInitialsOnAvatars(document);
    },
  }),
  styles: [style],
};

export { avatarInitials };
