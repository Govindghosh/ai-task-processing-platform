import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import TaskCard from '../components/TaskCard';
import {
  PlusCircle,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  BarChart3,
  RefreshCw,
  Inbox,
} from 'lucide-react';

const statCards = [
  { key: 'total', label: 'Total Tasks', icon: BarChart3, gradient: 'from-primary-600/20 to-primary-800/20', text: 'text-primary-400', border: 'border-primary-500/20' },
  { key: 'pending', label: 'Pending', icon: Clock, gradient: 'from-yellow-600/20 to-yellow-800/20', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  { key: 'running', label: 'Running', icon: Loader2, gradient: 'from-blue-600/20 to-blue-800/20', text: 'text-blue-400', border: 'border-blue-500/20' },
  { key: 'success', label: 'Completed', icon: CheckCircle2, gradient: 'from-emerald-600/20 to-emerald-800/20', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  { key: 'failed', label: 'Failed', icon: XCircle, gradient: 'from-red-600/20 to-red-800/20', text: 'text-red-400', border: 'border-red-500/20' },
];

const Dashboard = () => {
  const [stats, setStats] = useState({ total: 0, pending: 0, running: 0, success: 0, failed: 0 });
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);

      const [statsRes, tasksRes] = await Promise.all([
        api.get('/tasks/stats'),
        api.get('/tasks?limit=10'),
      ]);

      setStats(statsRes.data.data);
      setTasks(tasksRes.data.data.tasks);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 5s if there are pending/running tasks
    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Dashboard</h1>
          <p className="text-surface-400 text-sm mt-1">Monitor your AI task processing pipeline</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-surface-700/50 text-surface-400 hover:text-surface-200 hover:border-surface-600 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/tasks/new"
            id="create-task-btn"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white font-medium text-sm transition-all shadow-lg shadow-primary-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            New Task
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className={`glass-card p-5 animate-fade-in stagger-${index + 1} border ${card.border}`}
              style={{ opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-medium uppercase tracking-wider ${card.text}`}>
                  {card.label}
                </span>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${card.text} ${card.key === 'running' ? 'animate-spin' : ''}`} />
                </div>
              </div>
              <p className="text-3xl font-bold text-surface-100 animate-count-up">
                {stats[card.key]}
              </p>
            </div>
          );
        })}
      </div>

      {/* Recent Tasks */}
      <div className="animate-fade-in" style={{ animationDelay: '0.3s', opacity: 0 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-surface-200">Recent Tasks</h2>
          {tasks.length > 0 && (
            <Link
              to="/tasks"
              className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
            >
              View all
            </Link>
          )}
        </div>

        {tasks.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Inbox className="w-12 h-12 text-surface-600 mx-auto mb-4" />
            <h3 className="text-surface-300 font-medium mb-2">No tasks yet</h3>
            <p className="text-surface-500 text-sm mb-6">Create your first task to get started</p>
            <Link
              to="/tasks/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white font-medium text-sm transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              Create Task
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {tasks.map((task) => (
              <TaskCard key={task._id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
