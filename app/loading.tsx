import { Skeleton } from "../components/ui";

export default function Loading() {
  return <main className="content"><div className="page-shell"><Skeleton className="skeleton-line" /><Skeleton className="skeleton-block" /><Skeleton className="skeleton-block" /></div></main>;
}
