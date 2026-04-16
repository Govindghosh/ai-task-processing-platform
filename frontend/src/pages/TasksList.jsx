import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import TaskCard from '../components/TaskCard';
import { ListTodo, Loader2, Inbox, PlusCircle, ChevronLeft, ChevronRight } from 'lucide-react';

const TasksList = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchTasks = async (page = 1, status = 'all') => {
    try {
      setLoading(true);
      let targetUrl = `/tasks?page=${page}&limit=${pagination.limit}`;
      if (status !== 'all') {
        targetUrl += `&status=${status}`;
      }
      const res = await api.get(targetUrl);
      setTasks(res.data.data.tasks);
      setPagination(res.data.data.pagination);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks(1, statusFilter);
  }, [statusFilter]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchTasks(newPage, statusFilter);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-100 flex items-center gap-3">
            <ListTodo className="w-6 h-6 text-primary-500" />
            All Tasks
          </h1>
          <p className="text-surface-400 text-sm mt-1">View and manage your complete task history</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-surface-800/50 border border-surface-700/50 text-surface-200 text-sm outline-none focus:border-primary-500/50 transition-all cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="success">Completed</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="failed">Failed</option>
          </select>
          <Link
            to="/tasks/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white font-medium text-sm transition-all shadow-lg shadow-primary-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">New Task</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Inbox className="w-12 h-12 text-surface-600 mx-auto mb-4" />
          <h3 className="text-surface-300 font-medium mb-2">No tasks found</h3>
          <p className="text-surface-500 text-sm mb-6">
            {statusFilter === 'all' 
              ? "You haven't created any tasks yet." 
              : `No tasks found with status '${statusFilter}'.`}
          </p>
          {statusFilter === 'all' && (
            <Link
              to="/tasks/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 text-white font-medium text-sm transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              Create your first task
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3">
            {tasks.map((task) => (
              <TaskCard key={task._id} task={task} />
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between glass-card p-4 mt-6">
              <p className="text-sm text-surface-400">
                Showing <span className="font-medium text-surface-200">{(pagination.page - 1) * pagination.limit + 1}</span> to <span className="font-medium text-surface-200">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-medium text-surface-200">{pagination.total}</span> results
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="p-2 rounded-lg border border-surface-700 text-surface-300 hover:text-surface-100 hover:bg-surface-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    // Show pages around current
                    let pageNum = i + 1;
                    if (pagination.pages > 5) {
                      if (pagination.page > 3) {
                        pageNum = pagination.page - 2 + i;
                      }
                      if (pageNum > pagination.pages) return null;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                          pagination.page === pageNum
                            ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                            : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="p-2 rounded-lg border border-surface-700 text-surface-300 hover:text-surface-100 hover:bg-surface-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TasksList;
