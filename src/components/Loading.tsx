"use client";

import { useEffect, useState } from "react";
import styles from "./Loading.module.css";

export function Loading() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 301);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) {
    return null;
  }

  return <div role="status" aria-label="Loading" className={styles.spinner} />;
}
