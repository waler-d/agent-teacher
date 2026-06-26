export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 720 }}>
      <h1>Agent Teacher</h1>
      <p>飞书记忆策略学习导师 · 由 Cursor Cloud Agent 驱动</p>
      <ul>
        <li>Webhook：<code>/api/feishu/webhook</code></li>
        <li>Skill：<code>.cursor/skills/memory-strategy</code></li>
      </ul>
    </main>
  );
}
