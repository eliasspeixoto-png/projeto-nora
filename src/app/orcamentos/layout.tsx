import { ReactNode } from "react";

export default function OrcamentosLayout({ children }: { children: ReactNode }) {
  // This layout no longer needs to differentiate between public and private views.
  // It simply passes children through, allowing nested layouts to handle their own structure.
  return <>{children}</>;
}
