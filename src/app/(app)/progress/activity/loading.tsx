import { PageSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <PageSkeleton title="Activity" blocks={["h-36", "h-44", "h-56"]} />;
}
