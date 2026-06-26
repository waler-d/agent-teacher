export type KnowledgeSource = "ppt" | "qa";
export type MaterialType = "scatter" | "structured" | "concept";
export type ReviewResult = "pass" | "partial" | "fail";
export type Strength = "normal" | "weak";
export type PointStatus = "active" | "mastered";

/** 活跃知识点（参与复习调度） */
export type KnowledgePoint = {
  id: string;
  title: string;
  /** 提取用「线索→要点」，尽量 ≤120 字，只存回忆必需信息 */
  summary: string;
  /** 可选短线索，出题时不暴露 summary 全文 */
  cue?: string;
  source: KnowledgeSource;
  sourceDetail?: string;
  materialType: MaterialType;
  /** 关联知识点 id，用于交错复习、联想编码（有意义内容忘得更慢） */
  relatedIds?: string[];
  learnedAt: string;
  stageIndex: number;
  strength: Strength;
  /** SM-2 式可塑因子：越高间隔越长，范围约 1.3～2.8 */
  ease: number;
  consecutivePasses: number;
  nextReviewAt: string;
  lastReviewAt?: string;
  reviewHistory: Array<{ at: string; result: ReviewResult }>;
};

/** 已掌握归档：极简字段，释放活跃队列容量 */
export type ArchivedPoint = {
  id: string;
  title: string;
  cue?: string;
  source: KnowledgeSource;
  materialType: MaterialType;
  masteredAt: string;
};

export type QuizSession = {
  active: boolean;
  pointIds: string[];
  currentIndex: number;
  startedAt: string;
  /** 交错复习：混合不同 materialType */
  interleaved: boolean;
};

export type UserLearningState = {
  active: KnowledgePoint[];
  archived: ArchivedPoint[];
  quiz: QuizSession | null;
  stats: {
    totalAdded: number;
    totalMastered: number;
  };
};

export type KnowledgeAddInput = {
  title: string;
  summary: string;
  cue?: string;
  source: KnowledgeSource;
  sourceDetail?: string;
  materialType: MaterialType;
  relatedIds?: string[];
};

export type ReviewRecordInput = {
  id: string;
  result: ReviewResult;
};

export type QuizActionInput = {
  action: "start" | "continue" | "end" | null;
  pointIds?: string[];
};

export type MemoryStateBlock = {
  knowledge_add?: KnowledgeAddInput[];
  review_record?: ReviewRecordInput[];
  quiz?: QuizActionInput;
};

/** 叶修方向性间隔 × 可塑因子 */
export const REVIEW_STAGE_DAYS = [0, 1, 3, 7, 14, 30, 60, 120] as const;
export const MIN_POINTS_FOR_QUIZ = 3;
export const MAX_QUIZ_BATCH = 5;
export const WEAK_RETRY_DAYS = 1;
export const PARTIAL_RETRY_DAYS = 2;
export const MAX_SUMMARY_LEN = 120;
export const MAX_TITLE_LEN = 24;
export const MAX_HISTORY_LEN = 4;
export const MAX_ACTIVE_HINT = 500;
export const DEFAULT_EASE = 2.0;
export const MIN_EASE = 1.3;
export const MAX_EASE = 2.8;
export const MASTERED_MIN_STAGE = 6;
export const MASTERED_MIN_PASSES = 2;

export function createPointId(): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `kp_${stamp}_${rand}`;
}

export function addDays(iso: string | Date, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + Math.max(0, Math.round(days)));
  return date.toISOString();
}

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, "");
}

export function compactText(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function trimHistory(
  history: KnowledgePoint["reviewHistory"],
): KnowledgePoint["reviewHistory"] {
  return history.slice(-MAX_HISTORY_LEN);
}

export function isDue(point: KnowledgePoint, now = new Date()): boolean {
  return new Date(point.nextReviewAt).getTime() <= now.getTime();
}

export function intervalDaysForStage(stageIndex: number, ease: number): number {
  const base = REVIEW_STAGE_DAYS[Math.min(stageIndex, REVIEW_STAGE_DAYS.length - 1)] ?? 120;
  const scaled = base * (ease / DEFAULT_EASE);
  return Math.min(120, Math.max(stageIndex === 0 ? 0 : 1, Math.round(scaled)));
}

export type ScheduleOutcome =
  | { type: "active"; point: KnowledgePoint }
  | { type: "mastered"; point: KnowledgePoint; archived: ArchivedPoint };

export function scheduleAfterResult(
  point: KnowledgePoint,
  result: ReviewResult,
  now = new Date(),
): ScheduleOutcome {
  const at = now.toISOString();
  const history = trimHistory([...point.reviewHistory, { at, result }]);
  let { stageIndex, strength, ease, consecutivePasses } = point;

  if (result === "fail") {
    ease = Math.max(MIN_EASE, ease - 0.2);
    consecutivePasses = 0;
    strength = "weak";
    stageIndex = Math.max(0, stageIndex - 1);
    return {
      type: "active",
      point: {
        ...point,
        ease,
        consecutivePasses,
        strength,
        stageIndex,
        lastReviewAt: at,
        nextReviewAt: addDays(now, WEAK_RETRY_DAYS),
        reviewHistory: history,
      },
    };
  }

  if (result === "partial") {
    ease = Math.max(MIN_EASE, ease - 0.05);
    consecutivePasses = 0;
    return {
      type: "active",
      point: {
        ...point,
        ease,
        consecutivePasses,
        lastReviewAt: at,
        nextReviewAt: addDays(now, PARTIAL_RETRY_DAYS),
        reviewHistory: history,
      },
    };
  }

  ease = Math.min(MAX_EASE, ease + 0.08);
  consecutivePasses += 1;
  if (strength === "weak" && consecutivePasses >= 2) strength = "normal";

  const nextStage = Math.min(stageIndex + 1, REVIEW_STAGE_DAYS.length - 1);
  let days = intervalDaysForStage(nextStage, ease);
  if (strength === "weak" && nextStage <= 3) days = Math.min(days, 2);

  const updated: KnowledgePoint = {
    ...point,
    ease,
    consecutivePasses,
    strength,
    stageIndex: nextStage,
    lastReviewAt: at,
    nextReviewAt: addDays(now, days),
    reviewHistory: history,
  };

  if (nextStage >= MASTERED_MIN_STAGE && consecutivePasses >= MASTERED_MIN_PASSES) {
    return {
      type: "mastered",
      point: updated,
      archived: toArchived(updated, at),
    };
  }

  return { type: "active", point: updated };
}

export function toArchived(point: KnowledgePoint, masteredAt: string): ArchivedPoint {
  return {
    id: point.id,
    title: point.title,
    cue: point.cue,
    source: point.source,
    materialType: point.materialType,
    masteredAt,
  };
}

export function scheduleNewPoint(
  input: KnowledgeAddInput,
  now = new Date(),
  existingActive: KnowledgePoint[] = [],
): KnowledgePoint | null {
  const title = compactText(input.title, MAX_TITLE_LEN);
  const norm = normalizeTitle(title);
  if (existingActive.some((p) => normalizeTitle(p.title) === norm)) return null;

  const summary = compactText(input.summary, MAX_SUMMARY_LEN);
  if (!title || !summary) return null;

  const learnedAt = now.toISOString();
  const relatedIds = input.relatedIds?.filter(Boolean).slice(0, 5);

  return {
    id: createPointId(),
    title,
    summary,
    cue: input.cue ? compactText(input.cue, 40) : undefined,
    source: input.source,
    sourceDetail: input.sourceDetail ? compactText(input.sourceDetail, 60) : undefined,
    materialType: input.materialType,
    relatedIds: relatedIds?.length ? relatedIds : undefined,
    learnedAt,
    stageIndex: 0,
    strength: "normal",
    ease: DEFAULT_EASE,
    consecutivePasses: 0,
    nextReviewAt: addDays(now, REVIEW_STAGE_DAYS[0]),
    reviewHistory: [],
  };
}

export function getDuePoints(points: KnowledgePoint[], now = new Date()): KnowledgePoint[] {
  return points.filter((p) => isDue(p, now));
}

export function formatPointForPrompt(point: KnowledgePoint): string {
  const rel = point.relatedIds?.length ? `，关联${point.relatedIds.length}点` : "";
  return `- [${point.id}] ${point.title}（${point.materialType}/${point.source}，阶段${point.stageIndex}，ease${point.ease.toFixed(1)}${point.strength === "weak" ? "，需加强" : ""}${rel}，下次：${point.nextReviewAt.slice(0, 10)}）`;
}

export function emptyLearningState(): UserLearningState {
  return {
    active: [],
    archived: [],
    quiz: null,
    stats: { totalAdded: 0, totalMastered: 0 },
  };
}

/** 兼容旧版 { points, quiz } 结构 */
export function migrateLearningState(raw: unknown): UserLearningState {
  if (!raw || typeof raw !== "object") return emptyLearningState();

  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.active)) {
    return {
      active: obj.active as KnowledgePoint[],
      archived: (obj.archived as ArchivedPoint[]) ?? [],
      quiz: (obj.quiz as QuizSession | null) ?? null,
      stats: (obj.stats as UserLearningState["stats"]) ?? {
        totalAdded: (obj.active as KnowledgePoint[]).length,
        totalMastered: ((obj.archived as ArchivedPoint[]) ?? []).length,
      },
    };
  }

  if (Array.isArray(obj.points)) {
    const points = obj.points as KnowledgePoint[];
    return {
      active: points.map((p) => ({
        ...p,
        ease: p.ease ?? DEFAULT_EASE,
        consecutivePasses: p.consecutivePasses ?? 0,
        summary: compactText(p.summary, MAX_SUMMARY_LEN),
      })),
      archived: [],
      quiz: (obj.quiz as QuizSession | null) ?? null,
      stats: { totalAdded: points.length, totalMastered: 0 },
    };
  }

  return emptyLearningState();
}
