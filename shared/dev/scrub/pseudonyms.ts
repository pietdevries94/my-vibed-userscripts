// Consistent stand-ins for real values. The same real value gets the same stand-in
// everywhere in one capture. Every replaced value is recorded, so error messages can be redacted.

interface ReplacedValue {
  original: string;
  /** Where the value was, such as `a.bolt-table-row @aria-label` or `value.createdBy.displayName`. */
  field: string;
}

interface Pseudonyms {
  number: (value: number, field: string) => number;
  guid: (value: string, field: string) => string;
  date: (value: string, field: string) => string;
  text: (value: string, field: string) => string;
  /** Every real value replaced so far. */
  replaced: () => ReplacedValue[];
  /** Every stand-in handed out so far. */
  standIns: () => string[];
}

const FIRST_NUMBER = 1001;
const GUID_SEQUENCE_DIGITS = 12;
const FAKE_EPOCH_MS = Date.parse("2000-01-01T00:00:00Z");
const MS_PER_MINUTE = 60_000;

/** Hands out one stand-in per distinct key, made by `create` from a running count. */
function standInMap(create: (count: number) => string): (key: string) => string {
  const standIns = new Map<string, string>();
  return (key) => {
    const known = standIns.get(key);
    if (known !== undefined) {
      return known;
    }
    const created = create(standIns.size + 1);
    standIns.set(key, created);
    return created;
  };
}

function createPseudonyms(): Pseudonyms {
  const replaced: ReplacedValue[] = [];
  const handedOut = new Set<string>();
  const dates = standInMap((count) =>
    new Date(FAKE_EPOCH_MS + count * MS_PER_MINUTE).toISOString(),
  );
  const guids = standInMap(
    (count) => `00000000-0000-4000-8000-${String(count).padStart(GUID_SEQUENCE_DIGITS, "0")}`,
  );
  const numbers = standInMap((count) => String(FIRST_NUMBER + count - 1));
  const texts = standInMap((count) => `text-${count}`);
  const replace = (standIns: (key: string) => string, original: string, field: string): string => {
    replaced.push({ field, original });
    const standIn = standIns(original);
    handedOut.add(standIn);
    return standIn;
  };
  return {
    date: (value, field) => replace(dates, value, field),
    guid: (value, field) => replace((key) => guids(key.toLowerCase()), value, field),
    number: (value, field) => Number(replace(numbers, String(value), field)),
    replaced: () => [...replaced],
    standIns: () => [...handedOut],
    text: (value, field) => replace(texts, value, field),
  };
}

export type { Pseudonyms, ReplacedValue };
export { createPseudonyms };
