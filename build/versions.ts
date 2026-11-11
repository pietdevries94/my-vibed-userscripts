type Bump = "patch" | "minor" | "major";

const VERSION_LINE = /^\/\/ @version\s+(?<version>\S+)\s*$/mu;
const VERSION_PARTS = 3;

/** The `@version` of a userscript file, or null when it has none. */
function versionOf(userScript: string): string | null {
  return VERSION_LINE.exec(userScript)?.groups?.version ?? null;
}

/** Negative when left < right, zero when equal, positive when left > right. Plain x.y.z only. */
function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < VERSION_PARTS; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function bumpVersion(version: string, bump: Bump): string {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);
  if (bump === "major") {
    return `${major + 1}.0.0`;
  }
  if (bump === "minor") {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

function isBump(value: string): value is Bump {
  return value === "patch" || value === "minor" || value === "major";
}

export type { Bump };
export { bumpVersion, compareVersions, isBump, versionOf };
