import {
  type MemoryStateBlock,
  scheduleAfterResult,
  scheduleNewPoint,
  getDuePoints,
  emptyLearningState,
} from "@/lib/knowledge";
import {
  endQuiz,
  loadLearningState,
  pickQuizPoints,
  saveLearningState,
  startQuiz,
} from "@/lib/review";

const BLOCK_START = "<!--MEMORY_STATE-->";
const BLOCK_END = "<!--/MEMORY_STATE-->";

export function stripMemoryStateBlock(text: string): {
  visible: string;
  block: MemoryStateBlock | null;
} {
  const start = text.indexOf(BLOCK_START);
  const end = text.indexOf(BLOCK_END);
  if (start === -1 || end === -1 || end <= start) {
    return { visible: text.trim(), block: null };
  }

  const visible = (text.slice(0, start) + text.slice(end + BLOCK_END.length)).trim();
  const raw = text.slice(start + BLOCK_START.length, end).trim();

  try {
    const block = JSON.parse(raw) as MemoryStateBlock;
    return { visible, block };
  } catch {
    return { visible, block: null };
  }
}

export async function applyMemoryStateBlock(
  openId: string,
  block: MemoryStateBlock | null,
): Promise<void> {
  if (!block) return;

  const state = await loadLearningState(openId);
  let { active, archived, quiz, stats } = state;

  for (const item of block.knowledge_add ?? []) {
    const point = scheduleNewPoint(item, new Date(), active);
    if (!point) continue;
    active = [...active, point];
    stats = { ...stats, totalAdded: stats.totalAdded + 1 };
  }

  for (const record of block.review_record ?? []) {
    const idx = active.findIndex((p) => p.id === record.id);
    if (idx === -1) continue;

    const outcome = scheduleAfterResult(active[idx], record.result);
    if (outcome.type === "mastered") {
      active = active.filter((p) => p.id !== record.id);
      archived = [...archived, outcome.archived];
      stats = { ...stats, totalMastered: stats.totalMastered + 1 };
    } else {
      active[idx] = outcome.point;
    }
  }

  const quizInput = block.quiz;
  if (quizInput?.action === "start") {
    const ids =
      quizInput.pointIds?.filter(Boolean) ??
      pickQuizPoints(getDuePoints(active)).map((p) => p.id);
    if (ids.length > 0) quiz = startQuiz(ids);
  } else if (quizInput?.action === "end") {
    quiz = endQuiz();
  } else if (quizInput?.action === "continue" && quiz?.active) {
    quiz = { ...quiz, currentIndex: quiz.currentIndex + 1 };
    if (quiz.currentIndex >= quiz.pointIds.length) quiz = endQuiz();
  }

  await saveLearningState(openId, { active, archived, quiz, stats });
}

export async function processAgentReply(openId: string, rawReply: string): Promise<string> {
  const { visible, block } = stripMemoryStateBlock(rawReply);
  await applyMemoryStateBlock(openId, block);
  return visible;
}

export { emptyLearningState };
