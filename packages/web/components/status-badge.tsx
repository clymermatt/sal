const STATUS_COLORS: Record<string, string> = {
  booked: "bg-blue-100 text-blue-700",
  en_route: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-orange-100 text-orange-700",
  on_hold: "bg-red-100 text-red-700",
  return_scheduled: "bg-purple-100 text-purple-700",
  complete: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  // Invoice statuses
  pending: "bg-yellow-100 text-yellow-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  void: "bg-gray-100 text-gray-500",
};

export function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600";
  const label = status.replace(/_/g, " ");

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colors}`}
    >
      {label}
    </span>
  );
}
