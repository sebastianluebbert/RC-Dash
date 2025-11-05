import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  status?: "success" | "warning" | "error" | "normal";
}

export function DashboardCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  status = "normal",
}: DashboardCardProps) {
  const getStatusColor = () => {
    switch (status) {
      case "success":
        return "text-success";
      case "warning":
        return "text-warning";
      case "error":
        return "text-destructive";
      default:
        return "text-primary";
    }
  };

  return (
    <Card className="relative overflow-hidden border-border bg-card transition-all hover:shadow-[var(--shadow-glow)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-5 w-5 ${getStatusColor()}`} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-card-foreground">{value}</div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <p className="text-muted-foreground">{description}</p>
          {trend && (
            <span
              className={`font-medium ${
                trend.isPositive ? "text-success" : "text-destructive"
              }`}
            >
              {trend.isPositive ? "+" : ""}
              {trend.value}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
