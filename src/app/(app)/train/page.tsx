import type { Metadata } from "next";
import { Dumbbell } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = { title: "Train" };

export default function TrainPage() {
  return (
    <>
      <PageHeader title="Train" />
      <EmptyState Icon={Dumbbell} title="No routines yet">
        Your routines and live workout logging will show up here.
      </EmptyState>
    </>
  );
}
