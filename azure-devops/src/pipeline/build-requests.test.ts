import assert from "node:assert/strict";
import { createBuildRequests } from "./build-requests.ts";
import { test } from "node:test";

function fakeBuilds(respond: () => Response): {
  requests: ReturnType<typeof createBuildRequests>;
  urls: string[];
} {
  const urls: string[] = [];
  const requests = createBuildRequests({
    apiBasePath: "/quillfield",
    fetch: async (url) => {
      urls.push(url);
      return respond();
    },
    origin: "https://dev.azure.com",
  });
  return { requests, urls };
}

test("reads the pipeline of a run: its id and name", async () => {
  const build = { definition: { id: 31, name: "ledger-ci", path: "\\" }, id: 812 };
  const { requests, urls } = fakeBuilds(() => Response.json(build));
  assert.deepEqual(await requests.getBuildPipeline("Ledger Works", 812), {
    id: 31,
    name: "ledger-ci",
  });
  assert.deepEqual(urls, [
    "https://dev.azure.com/quillfield/Ledger%20Works/_apis/build/builds/812?api-version=7.1",
  ]);
});

test("a run without a pipeline in its answer is an error", async () => {
  const { requests } = fakeBuilds(() => Response.json({ id: 812 }));
  await assert.rejects(requests.getBuildPipeline("Ledger Works", 812));
});
