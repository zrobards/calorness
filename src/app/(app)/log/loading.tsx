import { PageSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <PageSkeleton title="Today" blocks={["h-16","h-44","h-24","h-40"]} />;
}
