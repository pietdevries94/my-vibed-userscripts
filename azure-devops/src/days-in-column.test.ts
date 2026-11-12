import type { DaysInColumnClient, WorkItemUpdate } from "./days-in-column.ts";
import {
  MAX_DOTS,
  columnEnteredAt,
  createDaysInColumn,
  daysSince,
  showDaysInColumn,
} from "./days-in-column.ts";
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { test } from "node:test";

const DAY_MS = 86_400_000;

const created = (date: string, column: string): WorkItemUpdate => ({
  fields: {
    "System.BoardColumn": { newValue: column },
    "System.ChangedDate": { newValue: date },
  },
  revisedDate: "2024-01-01T00:00:00Z",
});
const moved = (date: string, from: string, to: string): WorkItemUpdate => ({
  fields: {
    "System.BoardColumn": { newValue: to, oldValue: from },
    "System.ChangedDate": { newValue: date, oldValue: "2024-01-01T00:00:00Z" },
  },
});
const edited = (date: string): WorkItemUpdate => ({
  fields: { "System.ChangedDate": { newValue: date }, "System.Title": { newValue: "New" } },
});

test("a work item entered its column at its last column change", () => {
  const updates = [
    created("2024-03-01T10:00:00Z", "New"),
    moved("2024-03-04T10:00:00Z", "New", "Active"),
    edited("2024-03-05T10:00:00Z"),
    moved("2024-03-08T10:00:00Z", "Active", "Review"),
    edited("2024-03-09T10:00:00Z"),
  ];
  assert.equal(columnEnteredAt(updates), "2024-03-08T10:00:00Z");
});

test("a work item that never moved entered its column when it was created", () => {
  const updates = [created("2024-03-01T10:00:00Z", "New"), edited("2024-03-02T10:00:00Z")];
  assert.equal(columnEnteredAt(updates), "2024-03-01T10:00:00Z");
});

test("a work item without a board column has no column date", () => {
  assert.equal(columnEnteredAt([edited("2024-03-02T10:00:00Z")]), null);
  assert.equal(columnEnteredAt([]), null);
});

test("counts whole days", () => {
  const enteredAt = "2024-03-01T10:00:00Z";
  const start = Date.parse(enteredAt);
  assert.equal(daysSince(enteredAt, start + DAY_MS - 1), 0);
  assert.equal(daysSince(enteredAt, start + DAY_MS), 1);
  assert.equal(daysSince(enteredAt, start + 24 * DAY_MS + 5), 24);
  assert.equal(daysSince(enteredAt, start - DAY_MS), 0);
});

function card(id: number): { document: Document; element: HTMLElement } {
  const { document } = new JSDOM(
    `<div class="wit-card" data-itemid="${id}"><div class="card-content"><span>title</span></div></div>`,
  ).window;
  const element = document.querySelector<HTMLElement>(".wit-card");
  assert.ok(element !== null);
  return { document, element };
}

const dots = (element: HTMLElement): string[] =>
  [...element.querySelectorAll<HTMLElement>(".fix-ado-days-in-column > span")].map(
    (dot) => dot.dataset.age ?? "",
  );

test("shows a dot per day with the day count as tooltip", () => {
  const { element } = card(1);
  showDaysInColumn(element, 9);
  const bar = element.querySelector<HTMLElement>(".card-content > .fix-ado-days-in-column");
  assert.ok(bar !== null);
  assert.equal(bar.title, "9 days in this column");
  assert.deepEqual(dots(element), [
    ...Array.from({ length: 7 }, () => "fresh"),
    ...Array.from({ length: 2 }, () => "aging"),
  ]);
});

test("one day reads as a day, and old work turns red", () => {
  const { element } = card(1);
  showDaysInColumn(element, 1);
  assert.equal(
    element.querySelector<HTMLElement>(".fix-ado-days-in-column")?.title,
    "1 day in this column",
  );
  showDaysInColumn(element, 16);
  assert.equal(element.querySelectorAll(".fix-ado-days-in-column").length, 1);
  assert.deepEqual(dots(element).slice(13), ["aging", "old", "old"]);
});

test("caps the dots, not the count", () => {
  const { element } = card(1);
  showDaysInColumn(element, 120);
  assert.equal(dots(element).length, MAX_DOTS);
  assert.equal(
    element.querySelector<HTMLElement>(".fix-ado-days-in-column")?.title,
    "120 days in this column",
  );
});

test("less than a day shows no bar", () => {
  const { element } = card(1);
  showDaysInColumn(element, 3);
  showDaysInColumn(element, 0);
  assert.equal(element.querySelector(".fix-ado-days-in-column"), null);
});

interface FakeClient {
  client: DaysInColumnClient;
  requests: string[];
  revs: Map<number, number>;
}

function fakeClient(enteredAt: string): FakeClient {
  const requests: string[] = [];
  const revs = new Map<number, number>();
  const client: DaysInColumnClient = {
    async getWorkItemUpdates(id) {
      requests.push(`updates ${id}`);
      return { retryAfterSeconds: null, updates: [created(enteredAt, "New")] };
    },
    async getWorkItems(ids) {
      requests.push(`work items ${ids.join(",")}`);
      return {
        retryAfterSeconds: null,
        workItems: ids.map((id) => ({ changedById: null, id, rev: revs.get(id) ?? 1 })),
      };
    },
  };
  return { client, requests, revs };
}

const ENTERED_AT = "2024-03-01T10:00:00Z";

test("fetches the updates of a card once, and redraws a card the board re-rendered", async () => {
  let now = Date.parse(ENTERED_AT) + 3 * DAY_MS;
  const { client, requests } = fakeClient(ENTERED_AT);
  const { document, element } = card(7);
  const daysInColumn = createDaysInColumn({ client, document, now: () => now });

  await daysInColumn.sync();
  assert.deepEqual(requests, ["work items 7", "updates 7"]);
  assert.equal(dots(element).length, 3);

  element.querySelector(".fix-ado-days-in-column")?.remove();
  now += 1000;
  await daysInColumn.sync();
  assert.deepEqual(requests, ["work items 7", "updates 7"]);
  assert.equal(dots(element).length, 3);
});

test("a later check adds a day, and fetches the updates again when the work item changed", async () => {
  let now = Date.parse(ENTERED_AT) + 3 * DAY_MS;
  const { client, requests, revs } = fakeClient(ENTERED_AT);
  const { document, element } = card(7);
  const daysInColumn = createDaysInColumn({ client, document, now: () => now });
  await daysInColumn.sync();

  now += DAY_MS;
  await daysInColumn.sync();
  assert.deepEqual(requests, ["work items 7", "updates 7", "work items 7"]);
  assert.equal(dots(element).length, 4);

  revs.set(7, 2);
  now += DAY_MS;
  await daysInColumn.sync();
  assert.deepEqual(requests.slice(3), ["work items 7", "updates 7"]);
});

test("stops for this check when Azure DevOps asks to slow down", async () => {
  const { document } = new JSDOM(
    `<div class="wit-card" data-itemid="1"><div class="card-content"></div></div>
     <div class="wit-card" data-itemid="2"><div class="card-content"></div></div>`,
  ).window;
  const requests: number[] = [];
  const client: DaysInColumnClient = {
    async getWorkItemUpdates(id) {
      requests.push(id);
      return { retryAfterSeconds: 30, updates: [] };
    },
    getWorkItems: async (ids) => ({
      retryAfterSeconds: null,
      workItems: ids.map((id) => ({ changedById: null, id, rev: 1 })),
    }),
  };
  await createDaysInColumn({ client, document, now: () => 0 }).sync();
  assert.deepEqual(requests, [1]);
});
