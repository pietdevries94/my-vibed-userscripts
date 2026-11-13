// The owner's starred reviewers: people and groups they often add to a pull request.
// One list per organisation, kept in the script's storage.
import type { Identity } from "./reviewer-requests.ts";
import { personOrTeamName } from "./reviewers.ts";

interface StarredReviewersStorage {
  load: () => unknown;
  save: (starred: Identity[]) => void;
}

interface StarredReviewersStore {
  list: () => Identity[];
  isStarred: (id: string) => boolean;
  /** The starred identity with this name on the page, or null. */
  findByName: (name: string) => Identity | null;
  star: (identity: Identity) => void;
  unstar: (id: string) => void;
}

function isIdentity(value: unknown): value is Identity {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "displayName" in value &&
    typeof value.displayName === "string" &&
    "signInAddress" in value &&
    typeof value.signInAddress === "string" &&
    "isGroup" in value &&
    typeof value.isGroup === "boolean"
  );
}

/**
 * True when a name on the page is this identity's name. A team shows on the page
 * without its "[Project]\" prefix.
 */
function isNameOf(identity: Identity, name: string): boolean {
  const wanted = name.trim().toLowerCase();
  return [identity.displayName, personOrTeamName(identity.displayName)].some(
    (candidate) => candidate.trim().toLowerCase() === wanted,
  );
}

function createStarredReviewersStore(storage: StarredReviewersStorage): StarredReviewersStore {
  function list(): Identity[] {
    const stored = storage.load();
    return Array.isArray(stored)
      ? stored.filter((value): value is Identity => isIdentity(value))
      : [];
  }

  return {
    findByName: (name) => list().find((identity) => isNameOf(identity, name)) ?? null,
    isStarred: (id) => list().some((identity) => identity.id === id),
    list,
    star(identity) {
      const others = list().filter(({ id }) => id !== identity.id);
      storage.save([...others, identity]);
    },
    unstar(id) {
      storage.save(list().filter((identity) => identity.id !== id));
    },
  };
}

export type { StarredReviewersStorage, StarredReviewersStore };
export { createStarredReviewersStore, isNameOf };
