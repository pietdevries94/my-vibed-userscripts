// The owner's reviews: pending comments on a pull request, kept in the script's storage
// until the owner submits them. One storage key per pull request, so two tabs on
// different pull requests never write the same value.
import type { PullRequestRef } from "../../pull-requests/pull-request-link.ts";

/** Where a pending comment sits in a file. */
interface LineAnchor {
  filePath: string;
  /** "left" is the file before the change, "right" the file after it. */
  side: "left" | "right";
  line: number;
  /** How many characters the line has, for the end of the comment's range. */
  lineLength: number;
  /** The newest iteration when the owner wrote the comment, or null when it was not known. */
  iteration: number | null;
}

/** A comment the owner wrote and has not posted yet. */
interface PendingComment {
  /** Random, made when the comment is saved. */
  id: string;
  content: string;
  /** Null for a comment on the pull request as a whole. */
  anchor: LineAnchor | null;
  /** True once a submit tried to post it. A retry then first looks for it on the pull request. */
  isAttempted: boolean;
  /** Set as soon as Azure DevOps confirms the post. */
  postedThreadId: number | null;
}

/** The owner's pending comments on one pull request. Never empty in storage. */
interface Review {
  /** When a comment was last added, edited or deleted, or a submit last ran. */
  updatedAt: number;
  comments: PendingComment[];
}

interface ReviewStorage {
  load: (key: string) => unknown;
  save: (key: string, review: Review) => void;
  remove: (key: string) => void;
  keys: () => string[];
}

interface ReviewStoreOptions {
  storage: ReviewStorage;
  now: () => number;
  createId: () => string;
}

interface ReviewStore {
  /** The pending comments under this key, posted ones left out. */
  pending: (key: string) => PendingComment[];
  /** Every comment under this key, posted ones too. */
  comments: (key: string) => PendingComment[];
  /** Adds a comment after the others, or with `first` before them. */
  add: (
    key: string,
    comment: Pick<PendingComment, "anchor" | "content">,
    position?: "first" | "last",
  ) => PendingComment;
  change: (key: string, id: string, changes: Partial<Omit<PendingComment, "id">>) => void;
  /** Deletes one comment. The review goes with its last pending comment. */
  remove: (key: string, id: string) => void;
  discard: (key: string) => void;
  /** Deletes every review last changed more than `maxAgeMs` ago. */
  deleteOlderThan: (maxAgeMs: number) => void;
}

const KEY_PREFIX = "review:";

/** One review per pull request of one organisation on one host. */
function reviewKey(
  hostAndBasePath: string,
  { project, pullRequestId, repository }: PullRequestRef,
): string {
  return `${KEY_PREFIX}${hostAndBasePath}/${project}/${repository}/${pullRequestId}`;
}

function isLineAnchor(value: unknown): value is LineAnchor {
  return (
    typeof value === "object" &&
    value !== null &&
    "filePath" in value &&
    typeof value.filePath === "string" &&
    "side" in value &&
    (value.side === "left" || value.side === "right") &&
    "line" in value &&
    typeof value.line === "number" &&
    "lineLength" in value &&
    typeof value.lineLength === "number" &&
    "iteration" in value &&
    (value.iteration === null || typeof value.iteration === "number")
  );
}

function isPendingComment(value: unknown): value is PendingComment {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "content" in value &&
    typeof value.content === "string" &&
    "anchor" in value &&
    (value.anchor === null || isLineAnchor(value.anchor)) &&
    "isAttempted" in value &&
    typeof value.isAttempted === "boolean" &&
    "postedThreadId" in value &&
    (value.postedThreadId === null || typeof value.postedThreadId === "number")
  );
}

function isReview(value: unknown): value is Review {
  return (
    typeof value === "object" &&
    value !== null &&
    "updatedAt" in value &&
    typeof value.updatedAt === "number" &&
    "comments" in value &&
    Array.isArray(value.comments) &&
    value.comments.every((comment) => isPendingComment(comment))
  );
}

const isPending = ({ postedThreadId }: PendingComment): boolean => postedThreadId === null;

function deleteReviewsBefore(storage: ReviewStorage, time: number): void {
  for (const key of storage.keys().filter((name) => name.startsWith(KEY_PREFIX))) {
    const stored = storage.load(key);
    // A value the script cannot read is left alone.
    if (isReview(stored) && stored.updatedAt < time) {
      storage.remove(key);
    }
  }
}

function createReviewStore({ storage, now, createId }: ReviewStoreOptions): ReviewStore {
  function comments(key: string): PendingComment[] {
    const stored = storage.load(key);
    return isReview(stored) ? stored.comments : [];
  }

  /** Saves the comments, or deletes the review when none of them is pending. */
  function save(key: string, changed: PendingComment[]): void {
    if (changed.some((comment) => isPending(comment))) {
      storage.save(key, { comments: changed, updatedAt: now() });
    } else {
      storage.remove(key);
    }
  }

  return {
    add(key, { anchor, content }, position = "last") {
      const comment = { anchor, content, id: createId(), isAttempted: false, postedThreadId: null };
      const others = comments(key);
      save(key, position === "first" ? [comment, ...others] : [...others, comment]);
      return comment;
    },
    change(key, id, changes) {
      const changed = comments(key);
      const comment = changed.find((candidate) => candidate.id === id);
      if (comment !== undefined) {
        Object.assign(comment, changes);
        save(key, changed);
      }
    },
    comments,
    deleteOlderThan: (maxAgeMs) => {
      deleteReviewsBefore(storage, now() - maxAgeMs);
    },
    discard: (key) => {
      storage.remove(key);
    },
    pending: (key) => comments(key).filter((comment) => isPending(comment)),
    remove(key, id) {
      save(
        key,
        comments(key).filter((comment) => comment.id !== id),
      );
    },
  };
}

export type { LineAnchor, PendingComment, Review, ReviewStorage, ReviewStore };
export { createReviewStore, reviewKey };
