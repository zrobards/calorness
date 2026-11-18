import { PageSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <PageSkeleton title="Feed" blocks={["h-14", "h-48", "h-48"]} />;
}
