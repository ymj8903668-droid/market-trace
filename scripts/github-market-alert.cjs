const ALERT_TITLE = "🚨 Market Trace 数据更新异常";

function clean(value, maxLength = 1_000) {
  return String(value || "").replaceAll("\0", "").slice(0, maxLength);
}

function failureBody({ owner, repo, workflowName, summary, runUrl, now }) {
  return [
    `@${owner} Market Trace 自动更新或数据新鲜度检查失败。`,
    "",
    `- 工作流：${clean(workflowName, 200)}`,
    `- 时间：${clean(now, 100)}`,
    `- 原因：${clean(summary)}`,
    `- 运行记录：[打开 GitHub Actions](${clean(runUrl, 500)})`,
    "",
    `请检查数据接口、依赖安全审计、提交和 GitHub Pages 部署状态。参见[自动更新与告警手册](https://github.com/${owner}/${repo}#自动更新与告警)。`,
  ].join("\n");
}

async function manageMarketAlert({
  github,
  context,
  core,
  state,
  alertTitle = ALERT_TITLE,
  workflowName,
  summary,
  runUrl,
  now = new Date().toISOString(),
}) {
  if (state !== "failure" && state !== "recovered") {
    throw new Error(`Unknown market alert state: ${state}`);
  }

  const { owner, repo } = context.repo;
  const issueTitle = clean(alertTitle, 200);
  if (!issueTitle) throw new Error("Market alert title is required");
  const { data: openIssues } = await github.rest.issues.listForRepo({
    owner,
    repo,
    state: "open",
    per_page: 100,
  });
  const existing = openIssues.find((issue) => !issue.pull_request && issue.title === issueTitle);

  if (state === "failure") {
    const body = failureBody({ owner, repo, workflowName, summary, runUrl, now });
    if (existing) {
      await github.rest.issues.createComment({ owner, repo, issue_number: existing.number, body });
      core.notice(`Updated market-data alert issue #${existing.number}`);
      return existing.number;
    }

    const { data: created } = await github.rest.issues.create({
      owner,
      repo,
      title: issueTitle,
      body,
      assignees: [owner],
    });
    core.notice(`Created market-data alert issue #${created.number}`);
    return created.number;
  }

  if (!existing) {
    core.notice("No open market-data alert issue to close");
    return null;
  }

  await github.rest.issues.createComment({
    owner,
    repo,
    issue_number: existing.number,
    body: `✅ 数据更新链路已恢复。\n\n- 工作流：${clean(workflowName, 200)}\n- 时间：${clean(now, 100)}\n- 运行记录：[打开 GitHub Actions](${clean(runUrl, 500)})`,
  });
  await github.rest.issues.update({
    owner,
    repo,
    issue_number: existing.number,
    state: "closed",
    state_reason: "completed",
  });
  core.notice(`Closed recovered market-data alert issue #${existing.number}`);
  return existing.number;
}

module.exports = manageMarketAlert;
