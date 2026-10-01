import type { ReactNode } from "react";
import styles from "./AppShell.module.css";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <nav className={styles.sidebar}>
        <p className={styles.name}>Tracklite</p>
      </nav>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
