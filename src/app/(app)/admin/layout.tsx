import { PageHeader } from "@/components/PageHeader";
import { requireAdmin } from "@/lib/adminData";
import { AdminTabs } from "./AdminTabs";

// Owner-only: emails listed in ADMIN_EMAILS. Everyone else gets "not found".
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="pb-8">
      <PageHeader title="Admin" search={false} />
      <AdminTabs />
      {children}
    </div>
  );
}
