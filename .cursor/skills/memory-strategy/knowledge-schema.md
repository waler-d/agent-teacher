# 知识点与复习调度数据结构

## 复习间隔（小时，最强频率）

```
STAGES_HOURS = [1, 2, 4, 6, 12, 24, 36, 48]   // 最长 48h = 2 天
interval = min(48, STAGES[stage] × (ease / 2.0))
```

| 结果 | nextReviewAt |
|------|----------------|
| 新入库 | now + **1h** |
| pass | now + interval（阶段递进，上限 48h） |
| partial | now + **2h** |
| fail / 不会 | now + **1h**，weak，阶段回退 |

## 归档

stage ≥6 且 consecutivePasses ≥2 → archived

## PPT 字段示例

```json
{
  "title": "光反应场所",
  "cue": "类囊体上发生什么？",
  "summary": "光反应→类囊体膜",
  "source": "ppt",
  "sourceDetail": "生物.pptx p3",
  "materialType": "concept"
}
```
