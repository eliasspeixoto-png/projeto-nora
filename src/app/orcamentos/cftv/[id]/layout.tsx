import { ReactNode } from "react";

export default function CftvLayout({ children }: { children: ReactNode }) {
  return <div className="w-screen h-screen">{children}</div>;
}
