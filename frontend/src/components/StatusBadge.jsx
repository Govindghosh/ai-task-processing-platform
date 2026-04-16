import { Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react';

const statusConfig = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    dotClass: 'bg-yellow-400 animate-pulse',
  },
  running: {
    label: 'Running',
    icon: Loader2,
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    dotClass: 'bg-blue-400',
    iconAnimate: 'animate-spin',
  },
  success: {
    label: 'Success',
    icon: CheckCircle2,
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dotClass: 'bg-emerald-400',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
    dotClass: 'bg-red-400',
  },
};

const StatusBadge = ({ status, size = 'md' }) => {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
    lg: 'px-4 py-1.5 text-base gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.className} ${sizeClasses[size]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
      <Icon className={`${iconSizes[size]} ${config.iconAnimate || ''}`} />
      {config.label}
    </span>
  );
};

export default StatusBadge;
