import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function MetricWidget({ title, value, icon, description, delay = 0, trend }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="card-base group hover:border-white/30 hover:bg-surface-hover transition-all duration-500"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="text-steel group-hover:text-ink transition-colors">
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 caption-bold px-1.5 py-0.5 rounded border ${
            trend === 'up' ? 'text-white border-white/20 bg-white/10' : 
            trend === 'down' ? 'text-[#32d74b] border-[#32d74b]/20 bg-[#32d74b]/10' : 
            'text-stone border-hairline bg-surface'
          }`}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : trend === 'down' ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          </div>
        )}
      </div>
      
      <div>
        <h3 className="caption-bold text-steel mb-1">{title}</h3>
        <p className="heading-sm text-ink font-mono tracking-tight">{value}</p>
        {description && (
          <p className="caption text-steel mt-1">{description}</p>
        )}
      </div>
    </motion.div>
  );
}
