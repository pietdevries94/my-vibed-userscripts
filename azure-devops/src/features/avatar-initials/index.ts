import type { Feature } from "../../core/feature.ts";
import { showInitialsOnAvatars } from "../../avatars.ts";

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
};

export { avatarInitials };
