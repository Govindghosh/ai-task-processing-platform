import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { ArrowRight, Type, CaseLower, RotateCcw, Hash, Calendar } from 'lucide-react';

const operationIcons = {
  uppercase: Type,
  lowercase: CaseLower,
  reverse: RotateCcw,
  wordcount: Hash,
};

const operationLabels = {
  uppercase: 'Uppercase',
  lowercase: 'Lowercase',
  reverse: 'Reverse',
  wordcount: 'Word Count',
};

const TaskCard = ({ task }) => {
  const OpIcon = operationIcons[task.operation] || Type;
  const opLabel = operationLabels[task.operation] || task.operation;

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Link
      to={`/tasks/${task._id}`}
      id={`task-card-${task._id}`}
      className="glass-card block p-5 group cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-3">
          <h3 className="text-surface-100 font-semibold text-base truncate group-hover:text-primary-400 transition-colors">
            {task.title}
          </h3>
        </div>
        <StatusBadge status={task.status} size="sm" />
      </div>

      <p className="text-surface-400 text-sm line-clamp-2 mb-4">
        {task.input}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-surface-500 bg-surface-800/60 px-2.5 py-1 rounded-md">
            <OpIcon className="w-3 h-3" />
            {opLabel}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-surface-500">
            <Calendar className="w-3 h-3" />
            {formatDate(task.createdAt)}
          </span>
        </div>
        <ArrowRight className="w-4 h-4 text-surface-600 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
      </div>
    </Link>
  );
};

export default TaskCard;
