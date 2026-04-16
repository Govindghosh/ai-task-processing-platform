import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import {
  ArrowLeft,
  RefreshCw,
  Play,
  Loader2,
  Copy,
  Check,
  Terminal,
  Clock,
  FileText,
  Sparkles,
  Type,
  CaseLower,
  RotateCcw,
  Hash,
  AlertCircle,
} from 'lucide-react';

const operationMeta = {
  uppercase: { label: 'Uppercase', icon: Type, color: 'text-amber-400' },
  lowercase: { label: 'Lowercase', icon: CaseLower, color: 'text-blue-400' },
  reverse: { label: 'Reverse', icon: RotateCcw, color: 'text-purple-400' },
  wordcount: { label: 'Word Count', icon: Hash, color: 'text-emerald-400' },
};

const TaskDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const fetchTask = useCallback(async () => {
    try {
      const { data } = await api.get(`/tasks/${id}`);
      setTask(data.data.task);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch task');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  // Auto-poll while pending/running
  useEffect(() => {
    if (!task || (task.status !== 'pending' && task.status !== 'running')) return;

    const interval = setInterval(fetchTask, 2000);
    return () => clearInterval(interval);
  }, [task?.status, fetchTask]);

  const handleRerun = async () => {
    try {
      setRerunning(true);
      await api.post(`/tasks/${id}/run`);
      await fetchTask();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to re-run task');
    } finally {
      setRerunning(false);
    }
  };

  const handleCopyResult = () => {
    if (task?.result) {
      navigator.clipboard.writeText(task.result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getDuration = () => {
    if (!task?.startedAt || !task?.completedAt) return null;
    const ms = new Date(task.completedAt) - new Date(task.startedAt);
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="glass-card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-surface-200 mb-2">Error</h2>
          <p className="text-surface-400 text-sm mb-6">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-primary-400 hover:text-primary-300 text-sm font-medium"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const opMeta = operationMeta[task.operation] || {};
  const OpIcon = opMeta.icon || Sparkles;
  const duration = getDuration();

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Back + Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-surface-400 hover:text-surface-200 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-2">
          {task.status === 'failed' && (
            <button
              onClick={handleRerun}
              disabled={rerunning}
              id="rerun-task-btn"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-700/50 text-surface-300 hover:text-surface-100 hover:border-surface-600 text-sm transition-all disabled:opacity-50"
            >
              {rerunning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              Re-run
            </button>
          )}
          <button
            onClick={fetchTask}
            className="p-2 rounded-xl border border-surface-700/50 text-surface-400 hover:text-surface-200 hover:border-surface-600 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Task Info Card */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-surface-100 mb-1">{task.title}</h1>
            <div className="flex items-center gap-4 text-sm text-surface-500">
              <span className="flex items-center gap-1.5">
                <OpIcon className={`w-3.5 h-3.5 ${opMeta.color}`} />
                {opMeta.label}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {formatDate(task.createdAt)}
              </span>
              {duration && (
                <span className="flex items-center gap-1.5">
                  ⚡ {duration}
                </span>
              )}
              {task.retryCount > 0 && (
                <span className="text-yellow-400">
                  Retries: {task.retryCount}
                </span>
              )}
            </div>
          </div>
          <StatusBadge status={task.status} size="lg" />
        </div>

        {/* Input */}
        <div className="mt-6">
          <label className="flex items-center gap-2 text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">
            <FileText className="w-3.5 h-3.5" />
            Input
          </label>
          <div className="bg-surface-800/50 rounded-xl border border-surface-700/30 p-4 max-h-48 overflow-y-auto">
            <pre className="text-sm text-surface-300 whitespace-pre-wrap break-words font-mono">{task.input}</pre>
          </div>
        </div>

        {/* Result */}
        {task.result !== null && task.result !== undefined && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-xs font-medium text-surface-500 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                Result
              </label>
              <button
                onClick={handleCopyResult}
                className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-primary-400 transition-colors"
              >
                {copied ? (
                  <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</>
                ) : (
                  <><Copy className="w-3.5 h-3.5" /> Copy</>
                )}
              </button>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4 max-h-48 overflow-y-auto">
              <pre className="text-sm text-emerald-300 whitespace-pre-wrap break-words font-mono">{task.result}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Logs */}
      {task.logs && task.logs.length > 0 && (
        <div className="glass-card p-6">
          <label className="flex items-center gap-2 text-xs font-medium text-surface-500 uppercase tracking-wider mb-4">
            <Terminal className="w-3.5 h-3.5" />
            Processing Logs
          </label>
          <div className="space-y-2">
            {task.logs.map((log, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-2 px-3 rounded-lg bg-surface-800/30 text-sm"
              >
                <span className="text-xs text-surface-600 font-mono whitespace-nowrap mt-0.5">
                  {new Date(log.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
                <span
                  className={`text-xs font-medium uppercase w-10 mt-0.5 ${
                    log.level === 'error' ? 'text-red-400' :
                    log.level === 'warn' ? 'text-yellow-400' :
                    'text-blue-400'
                  }`}
                >
                  {log.level}
                </span>
                <span className="text-surface-300 flex-1">{log.message}</span>
              </div>
            ))}
          </div>

          {/* Live indicator */}
          {(task.status === 'pending' || task.status === 'running') && (
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-surface-800/50">
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-xs text-surface-500">Auto-refreshing every 2 seconds...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskDetail;
