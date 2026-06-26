# 知识点与复习调度数据结构

## 存储分层（最大容量）

| 层 | 内容 | 用途 |
|----|------|------|
| **active** | 完整 KnowledgePoint | 参与调度与出题 |
| **archived** | 仅 id/title/cue/source/materialType/masteredAt | 已掌握，不占复习队列 |
| **stats** | totalAdded / totalMastered | 统计 |

活跃库建议上限 ~500；超出时优先复习、归档、去重。

## KnowledgePoint（活跃）

| 字段 | 约束 | 说明 |
|------|------|------|
| title | ≤24 字 | 去重键（normalize 后比较） |
| summary | ≤120 字 | `线索→要点`，判题用 |
| cue | ≤40 字 | 出题线索，不暴露 summary |
| relatedIds | ≤5 个 id | 联想编码 + 交错复习 |
| ease | 1.3～2.8 | 可塑因子，pass↑ fail↓ |
| consecutivePasses | number | 连续 pass 次数 |
| stageIndex | 0～7 | 复习阶段 |
| strength | normal/weak | weak=曾不会 |

## 间隔（最低遗忘）

```
STAGES = [0, 1, 3, 7, 14, 30, 60, 120]  // 天
interval = STAGES[stage] × (ease / 2.0)
```

| 结果 | 行为 |
|------|------|
| pass | stage++，ease+0.08，按 interval 排 nextReviewAt |
| partial | 不推进 stage，2 天后再考，ease-0.05 |
| fail | stage 回退，ease-0.2，1 天后再考，weak |

**归档条件**：stage ≥6 且 consecutivePasses ≥2 → 移入 archived。

## 复习批次

- 到期 ≥3 触发
- 每批 ≤5 题，交错 materialType
- 一次一题，cue 出题

## knowledge_add 示例

```json
{
  "title": "光合作用场所",
  "cue": "叶绿体中主要反应？",
  "summary": "光反应→类囊体；暗反应→基质",
  "source": "ppt",
  "sourceDetail": "生物.pptx p12",
  "materialType": "concept",
  "relatedIds": ["kp_xxx"]
}
```

## Agent 状态块

```json
{
  "knowledge_add": [],
  "review_record": [{ "id": "kp_xxx", "result": "pass" }],
  "quiz": { "action": "continue", "pointIds": [] }
}
```
