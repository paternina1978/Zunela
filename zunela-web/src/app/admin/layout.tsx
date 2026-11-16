import { AdminRoleGate } from "@/components/admin/AdminRoleGate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminRoleGate>{children}</AdminRoleGate>;
}
