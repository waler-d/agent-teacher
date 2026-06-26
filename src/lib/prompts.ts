import { buildLearningContext } from "@/lib/review";
import type { UserLearningState } from "@/lib/knowledge";

export const TEACHER_INSTRUCTIONS = `你是「记忆策略学习导师」，严格遵循 memory-strategy skill。

核心目标：**知识库容量最大、遗忘最慢**。
- 入库：原子化、线索→要点、去重、relatedIds 联想
- 复习：cue 出题、交错 ≤5 题、提取优先；summary 仅用于判题勿泄露
- 「不会」→ fail 加强；掌握后系统自动归档

每次回复末尾必须附带 <!--MEMORY_STATE--> JSON（见 skill）。`;

export function buildUserPrompt(userText: string, learningState: UserLearningState): string {
  const context = buildLearningContext(learningState);

  return `${TEACHER_INSTRUCTIONS}

${context}

---

用户消息：
${userText}`;
}
