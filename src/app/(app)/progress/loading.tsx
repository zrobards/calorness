import { PageSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <PageSkeleton title="Progress" blocks={["h-80","h-48"]} />;
}
