import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { getMe } from "@/lib/api";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getMe();

  if (!me) {
    redirect("/auth/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar businessName={me.business.name} />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
