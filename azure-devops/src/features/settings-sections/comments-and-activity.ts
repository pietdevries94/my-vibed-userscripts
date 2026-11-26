import type { SettingsSection } from "../../core/feature.ts";
import { activityOrder } from "../activity-order/index.ts";
import { collapsibleThreads } from "../collapsible-threads/index.ts";
import { foldedPushes } from "../folded-pushes/index.ts";
import { joinedReviewerLines } from "../joined-reviewer-lines/index.ts";
import { newActivityChips } from "../new-activity-chips/index.ts";
import { resolvedThreadChips } from "../resolved-thread-chips/index.ts";
import { scrollToBottom } from "../scroll-to-bottom/index.ts";
import { unreadComments } from "../unread-comments/index.ts";

const commentsAndActivitySection: SettingsSection = {
  description: "The comments and updates on a pull request's Overview.",
  groups: [
    {
      features: [
        activityOrder,
        foldedPushes,
        joinedReviewerLines,
        newActivityChips,
        scrollToBottom,
      ],
      name: "Activity",
    },
    { features: [resolvedThreadChips, collapsibleThreads, unreadComments], name: "Threads" },
  ],
  name: "Comments and activity",
};

export { commentsAndActivitySection };
