import {
  type KnowledgePoint,
  type QuizSession,
  type UserLearningState,
  MIN_POINTS_FOR_QUIZ,
  MAX_QUIZ_BATCH,
  MAX_ACTIVE_HINT,
  getDuePoints,
  formatPointForPrompt,
  emptyLearningState,
  migrateLearningState,
} from "@/lib/knowledge";
import { getRedis } from "@/lib/redis";

const STATE_PREFIX = "agent-teacher:learning:";

export async function loadLearningState(openId: string): Promise<UserLearningState> {
  const store = getRedis();
  if (!store) return emptyLearningState();

  const data = await store.get<unknown>(`${STATE_PREFIX}${openId}`);
  return migrateLearningState(data);
}

export async function saveLearningState(openId: string, state: UserLearningState): Promise<void> {
  const store = getRedis();
  if (!store) return;
  await store.set(`${STATE_PREFIX}${openId}`, state);
}

function groupByMaterialType(points: KnowledgePoint[]): Map<string, KnowledgePoint[]> {
  const map = new Map<string, KnowledgePoint[]>();
  for (const p of points) {
    const key = p.materialType;
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  return map;
}

/** 交错选题：混合 materialType，weak 优先，分散单次题量 */
export function pickQuizPoints(due: KnowledgePoint[], limit = MAX_QUIZ_BATCH): KnowledgePoint[] {
  const sorted = [...due].sort((a, b) => {
    if (a.strength === "weak" && b.strength !== "weak") return -1;
    if (b.strength === "weak" && a.strength !== "weak") return 1;
    return new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime();
  });

  const picked: KnowledgePoint[] = [];
  const used = new Set<string>();
  const groups = groupByMaterialType(sorted);

  while (picked.length < limit && picked.length < sorted.length) {
    let added = false;
    for (const [, list] of groups) {
      const next = list.find((p) => !used.has(p.id));
      if (!next) continue;
      picked.push(next);
      used.add(next.id);
      added = true;
      if (picked.length >= limit) break;
    }
    if (!added) break;
  }

  for (const p of sorted) {
    if (picked.length >= limit) break;
    if (!used.has(p.id)) {
      picked.push(p);
      used.add(p.id);
    }
  }

  return picked;
}

export function buildLearningContext(state: UserLearningState, now = new Date()): string {
  const due = getDuePoints(state.active, now);
  const weak = state.active.filter((p) => p.strength === "weak");
  const recent = [...state.active]
    .sort((a, b) => new Date(b.learnedAt).getTime() - new Date(a.learnedAt).getTime())
    .slice(0, 8);

  const lines: string[] = [];

  lines.push("## 知识库概览（最大容量 + 最低遗忘策略）");
  lines.push(`- 活跃知识点：${state.active.length}（上限建议 ${MAX_ACTIVE_HINT}，超出请优先复习归档）`);
  lines.push(`- 已掌握归档：${state.archived.length}（仅保留标题/线索，不占复习队列）`);
  lines.push(`- 累计入库：${state.stats.totalAdded}，累计掌握：${state.stats.totalMastered}`);
  lines.push("");
  lines.push("入库规则：一条一点；summary 用「线索→要点」≤120字；关联 relatedIds；禁止重复 title。");
  lines.push("复习调度：**以小时为单位**，最强频率；「不会」→ **1 小时**后再考；最长间隔 **48 小时（2 天）**。");

  lines.push("");
  lines.push(`## 到期应复习（${due.length} 个）— 优先处理`);
  if (due.length === 0) {
    lines.push("（暂无到期项）");
  } else {
    for (const p of due.slice(0, 15)) lines.push(formatPointForPrompt(p));
    if (due.length > 15) lines.push(`… 另有 ${due.length - 15} 个到期项`);
  }

  if (weak.length > 0) {
    lines.push("");
    lines.push(`## 需加强（${weak.length} 个）`);
    for (const p of weak.slice(0, 8)) lines.push(formatPointForPrompt(p));
  }

  lines.push("");
  lines.push("## 最近入库（供关联编码，出题时勿泄露 summary）");
  if (recent.length === 0) {
    lines.push("（无）");
  } else {
    for (const p of recent) {
      lines.push(
        `- [${p.id}] ${p.title}（cue: ${p.cue ?? "无"}，summary 仅用于判题）${p.relatedIds?.length ? ` → 关联 ${p.relatedIds.join(",")}` : ""}`,
      );
    }
  }

  const hour = now.getHours();
  if (hour >= 21 || hour <= 23) {
    lines.push("");
    lines.push("🌙 睡前时段：优先安排 5～10 分钟提取式复习（高杠杆）。");
  }

  const shouldQuiz = due.length >= MIN_POINTS_FOR_QUIZ && !state.quiz?.active;
  if (shouldQuiz) {
    lines.push("");
    lines.push(
      `⚠️ 到期 ${due.length} 个（≥${MIN_POINTS_FOR_QUIZ}）。请交错出题（每次 ≤${MAX_QUIZ_BATCH} 题，一次一题提取）。用户说「复习/出题/考我」可立即开始。`,
    );
  }

  if (state.quiz?.active) {
    lines.push("");
    lines.push("## 进行中的复习场次（交错提取）");
    lines.push(`- 进度：第 ${state.quiz.currentIndex + 1} / ${state.quiz.pointIds.length} 题`);
    lines.push(`- id 列表：${state.quiz.pointIds.join(", ")}`);
    lines.push("- 用 cue 出题，禁止先给 summary；「不会」→ fail + 加强。");
  }

  if (state.active.length >= MAX_ACTIVE_HINT * 0.9) {
    lines.push("");
    lines.push("⚠️ 活跃库接近上限：新内容务必原子化；已掌握点会自动归档；避免重复入库。");
  }

  return lines.join("\n");
}

export function startQuiz(pointIds: string[]): QuizSession {
  return {
    active: true,
    pointIds,
    currentIndex: 0,
    startedAt: new Date().toISOString(),
    interleaved: true,
  };
}

export function endQuiz(): null {
  return null;
}
