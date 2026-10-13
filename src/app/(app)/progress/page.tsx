import type { Metadata } from "next";
import { TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return (
    <>
      <PageHeader title="Progress" />
      <EmptyState Icon={TrendingUp} title="Nothing to chart yet">
        Strength, bodyweight, and nutrition trends appear once you start logging.
      </EmptyState>
    </>
  );
}
