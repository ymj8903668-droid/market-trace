import test from "node:test";
import assert from "node:assert/strict";

import manageMarketAlert from "./github-market-alert.cjs";

function fixture(openIssues = []) {
  const calls = { create: [], createComment: [], update: [], notices: [] };
  return {
    calls,
    github: {
      rest: {
        issues: {
          listForRepo: async () => ({ data: openIssues }),
          create: async (input) => { calls.create.push(input); return { data: { number: 41 } }; },
          createComment: async (input) => { calls.createComment.push(input); },
          update: async (input) => { calls.update.push(input); },
        },
      },
    },
    context: { repo: { owner: "ymj8903668-droid", repo: "market-trace" } },
    core: { notice: (message) => calls.notices.push(message) },
  };
}

const details = {
  workflowName: "Refresh market data",
  summary: "Dependency audit failed",
  runUrl: "https://github.com/ymj8903668-droid/market-trace/actions/runs/123",
  now: "2026-08-16T04:00:00.000Z",
};

test("failure creates one assigned alert issue when none is open", async () => {
  const runtime = fixture();
  await manageMarketAlert({ ...runtime, state: "failure", ...details });

  assert.equal(runtime.calls.create.length, 1);
  assert.deepEqual(runtime.calls.create[0].assignees, ["ymj8903668-droid"]);
  assert.match(runtime.calls.create[0].body, /@ymj8903668-droid/);
  assert.match(runtime.calls.create[0].body, /Dependency audit failed/);
  assert.equal(runtime.calls.createComment.length, 0);
});

test("repeated failure comments on the existing alert instead of creating duplicates", async () => {
  const runtime = fixture([{ number: 7, title: "🚨 Market Trace 数据更新异常" }]);
  await manageMarketAlert({ ...runtime, state: "failure", ...details });

  assert.equal(runtime.calls.create.length, 0);
  assert.equal(runtime.calls.createComment.length, 1);
  assert.equal(runtime.calls.createComment[0].issue_number, 7);
});

test("recovery closes the existing alert with a recovery comment", async () => {
  const runtime = fixture([{ number: 7, title: "🚨 Market Trace 数据更新异常" }]);
  await manageMarketAlert({ ...runtime, state: "recovered", ...details });

  assert.equal(runtime.calls.createComment.length, 1);
  assert.match(runtime.calls.createComment[0].body, /恢复/);
  assert.deepEqual(runtime.calls.update[0], {
    owner: "ymj8903668-droid",
    repo: "market-trace",
    issue_number: 7,
    state: "closed",
    state_reason: "completed",
  });
});

test("recovery is a no-op when there is no open alert", async () => {
  const runtime = fixture();
  await manageMarketAlert({ ...runtime, state: "recovered", ...details });

  assert.equal(runtime.calls.create.length, 0);
  assert.equal(runtime.calls.createComment.length, 0);
  assert.equal(runtime.calls.update.length, 0);
});

test("different alert titles keep workflow failures and stale-data incidents independent", async () => {
  const runtime = fixture([{ number: 7, title: "🚨 Market Trace 自动更新失败" }]);
  await manageMarketAlert({
    ...runtime,
    state: "failure",
    alertTitle: "🚨 Market Trace 数据断更",
    ...details,
  });

  assert.equal(runtime.calls.createComment.length, 0);
  assert.equal(runtime.calls.create.length, 1);
  assert.equal(runtime.calls.create[0].title, "🚨 Market Trace 数据断更");
});
