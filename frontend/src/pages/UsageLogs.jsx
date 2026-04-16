import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Activity, Loader2, Clock, Globe } from 'lucide-react';

const methodColors = {
  GET: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  POST: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  PUT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  DELETE: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const UsageLogs = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const [logsRes, statsRes] = await Promise.all([
          api.get('/logs?limit=100'),
          api.get('/logs/stats')
        ]);
        setLogs(logsRes.data.data.logs);
        setStats(statsRes.data.data);
      } catch (error) {
        console.error('Failed to fetch logs', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLogs();
    // Auto-refresh logs every 10 seconds
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  // Calculate total requests from stats
  const totalRequests = stats.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-100 flex items-center gap-3">
          <Activity className="w-6 h-6 text-primary-500" />
          System Usage Logs
        </h1>
        <p className="text-surface-400 text-sm mt-1">Real-time monitoring of API traffic, user activity, and platform health.</p>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div className="glass-card p-5 border border-primary-500/20">
           <div className="text-xs font-medium uppercase tracking-wider text-primary-400 mb-1">Total Requests</div>
           <div className="text-3xl font-bold text-surface-100 animate-count-up">{totalRequests}</div>
        </div>
        {stats.map((stat, idx) => (
          <div key={idx} className="glass-card p-5 border border-surface-700/50">
             <div className="text-xs font-medium uppercase tracking-wider text-surface-400 mb-1">{stat._id} Traffic</div>
             <div className="text-3xl font-bold text-surface-100 animate-count-up">{stat.count}</div>
             <div className="text-xs text-surface-500 mt-2 flex items-center gap-1">
               <Clock className="w-3 h-3"/> Avg {Math.round(stat.avgResponseTime)}ms
             </div>
          </div>
        ))}
      </div>

      {/* Real-time Logs Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-surface-700/50 flex items-center justify-between bg-surface-800/30">
          <h2 className="text-sm font-semibold text-surface-200 uppercase tracking-widest">Recent Activity Streams</h2>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs text-surface-500">Live</span>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-800/50 text-surface-400 sticky top-0 backdrop-blur-md z-10">
              <tr>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Timestamp</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Method & Route</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Status</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Time</th>
                <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">User / IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800/50">
              {logs.map((log) => (
                <tr key={log._id} className="hover:bg-surface-800/20 transition-colors">
                  <td className="px-6 py-4 text-surface-400 whitespace-nowrap text-xs">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded border text-[10px] font-bold ${methodColors[log.method] || 'bg-surface-700 text-surface-300'}`}>
                        {log.method}
                      </span>
                      <span className="text-surface-200 font-mono text-xs">{log.path}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold border
                      ${log.statusCode < 400 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                      {log.statusCode}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-mono ${log.responseTime > 500 ? 'text-yellow-400' : 'text-surface-300'}`}>
                      {log.responseTime}ms
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-surface-200 text-xs font-medium">{log.userId?.name || 'Anonymous Session'}</span>
                      <span className="text-surface-500 text-[10px] flex items-center gap-1 mt-0.5 font-mono">
                        <Globe className="w-3 h-3" /> {log.ip}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-surface-500">
                    No activity logs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UsageLogs;
