// The script log. In the dev file, log() keeps entries for the next capture.
// The release build drops every log() call (esbuild `pure`), so logging costs nothing there.
// Pass a string literal as the message: the capture keeps it as it is, and scrubs `data`.

interface LogEntry {
  message: string;
  data?: unknown;
}

const MAX_ENTRIES = 500;
const entries: LogEntry[] = [];

function log(message: string, data?: unknown): void {
  entries.push(data === undefined ? { message } : { data, message });
  if (entries.length > MAX_ENTRIES) {
    entries.shift();
  }
}

function logEntries(): LogEntry[] {
  return [...entries];
}

export type { LogEntry };
export { log, logEntries };
