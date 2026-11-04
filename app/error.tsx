"use client";

import { useEffect } from "react";
import { Button, ErrorState } from "../components/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="content"><div className="page-shell"><ErrorState message="Refresh the view or try again." /><div className="state-box"><Button onClick={reset}>Try again</Button></div></div></main>;
}
