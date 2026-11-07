"use client";

import { useEffect, useState } from "react";

export function SlowLoadingMessage() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 3000);
    return () => window.clearTimeout(timer);
  }, []);
  return slow ? <p className="muted" role="status">Waking up the database, the first load can take a few seconds</p> : null;
}
