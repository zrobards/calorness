import { PageSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <PageSkeleton title="Diary" blocks={["h-96","h-24","h-24"]} />;
}
