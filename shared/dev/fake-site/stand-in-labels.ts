// Invented names for the capture's text tokens that stand for names, so a fake page
// shows names again. A token is the same real value everywhere in one capture, so
// replacing it everywhere is right. The names are invented; never use a real person's.

const INVENTED_NAMES = [
  "Holt, Mira",
  "Tomas van Elst",
  "Brandt, Ivo",
  "Lena Okafor",
  "Vale, Juniper",
  "Otto Pennywhistle",
  "Moor, Saskia",
  "Ravi Thornbury",
  "Fairweather, Ellis",
  "Noor Castell",
  "Kettleby, Bram",
  "Ada Brightwater",
];

/** An invented name per token, in the order given. After the list runs out: "Person 13" and on. */
function standInLabels(tokens: Iterable<string>): Map<string, string> {
  const labels = new Map<string, string>();
  for (const token of tokens) {
    if (!labels.has(token)) {
      labels.set(token, INVENTED_NAMES[labels.size] ?? `Person ${labels.size + 1}`);
    }
  }
  return labels;
}

/** `text` with every token in `labels` swapped for its name. `text-3` never matches inside `text-30`. */
function withStandInLabels(text: string, labels: Map<string, string>): string {
  if (labels.size === 0) {
    return text;
  }
  const tokens = [...labels.keys()].toSorted((left, right) => right.length - left.length);
  const pattern = new RegExp(`(?<![\\w-])(?:${tokens.join("|")})(?![\\w-])`, "gu");
  return text.replaceAll(pattern, (token) => labels.get(token) ?? token);
}

export { standInLabels, withStandInLabels };
