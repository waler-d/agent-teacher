import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Teacher",
  description: "飞书记忆策略学习导师",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
