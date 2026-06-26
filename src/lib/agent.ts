import { Agent, AgentBusyError, CursorAgentError } from "@cursor/sdk";
import { buildUserPrompt } from "@/lib/prompts";
import { getAgentIdForUser, saveAgentIdForUser } from "@/lib/session";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

function getCloudOptions() {
  const repoUrl = process.env.CURSOR_AGENT_REPO_URL;
  if (!repoUrl) {
    throw new Error(
      "缺少 CURSOR_AGENT_REPO_URL。请将本项目推送到 GitHub 并在 Cursor 中连接该仓库。",
    );
  }

  return {
    repos: [{ url: repoUrl, startingRef: process.env.CURSOR_AGENT_REPO_REF ?? "main" }],
  };
}

async function collectAssistantText(
  run: Awaited<ReturnType<Awaited<ReturnType<typeof Agent.create>>["send"]>>,
): Promise<string> {
  let text = "";

  for await (const event of run.stream()) {
    if (event.type !== "assistant") continue;
    for (const block of event.message.content) {
      if (block.type === "text") text += block.text;
    }
  }

  const result = await run.wait();
  if (result.status === "error") {
    throw new Error(`Cloud Agent 运行失败：${result.id}`);
  }

  if (text.trim()) return text.trim();
  if (typeof result.result === "string" && result.result.trim()) {
    return result.result.trim();
  }

  return "抱歉，我暂时无法生成回复，请稍后再试。";
}

async function createTeacherAgent(apiKey: string) {
  return Agent.create({
    apiKey,
    model: { id: process.env.CURSOR_AGENT_MODEL ?? "composer-2.5" },
    cloud: getCloudOptions(),
  });
}

async function withTeacherAgent<T>(
  openId: string,
  apiKey: string,
  fn: (agent: Awaited<ReturnType<typeof createTeacherAgent>>) => Promise<T>,
): Promise<T> {
  const existingId = await getAgentIdForUser(openId);

  if (existingId) {
    try {
      const agent = await Agent.resume(existingId, { apiKey });
      try {
        return await fn(agent);
      } finally {
        await agent[Symbol.asyncDispose]?.();
      }
    } catch (error) {
      if (!(error instanceof CursorAgentError)) throw error;
    }
  }

  const agent = await createTeacherAgent(apiKey);
  try {
    const result = await fn(agent);
    await saveAgentIdForUser(openId, agent.agentId);
    return result;
  } finally {
    await agent[Symbol.asyncDispose]?.();
  }
}

export async function askTeacher(openId: string, userText: string): Promise<string> {
  const apiKey = requireEnv("CURSOR_API_KEY");
  const prompt = buildUserPrompt(userText);

  return withTeacherAgent(openId, apiKey, async (agent) => {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const run = await agent.send(prompt);
        return await collectAssistantText(run);
      } catch (error) {
        if (error instanceof AgentBusyError && attempt < maxAttempts) {
          await sleep(2000 * attempt);
          continue;
        }
        throw error;
      }
    }

    throw new Error("Cloud Agent 忙碌，请稍后再试。");
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
