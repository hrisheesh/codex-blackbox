import { motion } from "framer-motion";
import { ReactNode } from "react";

interface MetricWidgetProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  delay?: number;
  trend?: "up" | "down" | "neutral";
}

export function MetricWidget({ title, value, icon, description, delay = 0, trend }: MetricWidgetProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-card rounded-xl p-5 flex flex-col hover:border-primary/50 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className="text-primary/70">{icon}</div>
      </div>
      <div className="flex items-baseline space-x-2">
        <h2 className="text-3xl font-bold tracking-tight">{value}</h2>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground mt-2">{description}</p>
      )}
    </motion.div>
  );
}
