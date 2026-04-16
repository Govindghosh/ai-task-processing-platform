import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { taskSchema } from '../schemas/auth';
import api from '../lib/api';
import {
  Type,
  CaseLower,
  RotateCcw,
  Hash,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles,
  FileText,
} from 'lucide-react';

const operations = [
  {
    value: 'uppercase',
    label: 'Uppercase',
    description: 'Convert all text to uppercase',
    icon: Type,
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    value: 'lowercase',
    label: 'Lowercase',
    description: 'Convert all text to lowercase',
    icon: CaseLower,
    gradient: 'from-blue-500 to-cyan-600',
  },
  {
    value: 'reverse',
    label: 'Reverse',
    description: 'Reverse the entire text',
    icon: RotateCcw,
    gradient: 'from-purple-500 to-pink-600',
  },
  {
    value: 'wordcount',
    label: 'Word Count',
    description: 'Count total words in text',
    icon: Hash,
    gradient: 'from-emerald-500 to-teal-600',
  },
];

const CreateTask = () => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: '', input: '', operation: '' },
  });

  const selectedOp = watch('operation');
  const inputText = watch('input');

  const onSubmit = async (data) => {
    try {
      setServerError('');
      const res = await api.post('/tasks', data);
      navigate(`/tasks/${res.data.data.task._id}`);
    } catch (err) {
      setServerError(
        err.response?.data?.message || 'Failed to create task. Please try again.'
      );
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-100">Create New Task</h1>
            <p className="text-surface-400 text-sm">Define your text processing task</p>
          </div>
        </div>

        {serverError && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Title */}
          <div className="glass-card p-6">
            <label htmlFor="title" className="block text-sm font-medium text-surface-300 mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-400" />
                Task Title
              </div>
            </label>
            <input
              {...register('title')}
              type="text"
              id="title"
              placeholder="e.g., Convert user feedback to uppercase"
              className={`w-full px-4 py-3 rounded-xl bg-surface-800/50 border text-surface-100 placeholder-surface-600 text-sm outline-none transition-all focus:ring-2 focus:ring-primary-500/30 ${
                errors.title ? 'border-red-500/50' : 'border-surface-700/50 focus:border-primary-500/50'
              }`}
            />
            {errors.title && (
              <p className="text-red-400 text-xs mt-1.5">{errors.title.message}</p>
            )}
          </div>

          {/* Operation Selection */}
          <div className="glass-card p-6">
            <label className="block text-sm font-medium text-surface-300 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary-400" />
                Select Operation
              </div>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {operations.map((op) => {
                const Icon = op.icon;
                const isSelected = selectedOp === op.value;
                return (
                  <button
                    type="button"
                    key={op.value}
                    onClick={() => setValue('operation', op.value, { shouldValidate: true })}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-primary-500/50 bg-primary-500/5 ring-2 ring-primary-500/20'
                        : 'border-surface-700/30 hover:border-surface-600/50 bg-surface-800/20 hover:bg-surface-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${op.gradient} flex items-center justify-center`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <span className={`font-medium text-sm ${isSelected ? 'text-primary-300' : 'text-surface-300'}`}>
                        {op.label}
                      </span>
                    </div>
                    <p className="text-xs text-surface-500 ml-11">{op.description}</p>
                  </button>
                );
              })}
            </div>
            <input type="hidden" {...register('operation')} />
            {errors.operation && (
              <p className="text-red-400 text-xs mt-2">{errors.operation.message}</p>
            )}
          </div>

          {/* Input Text */}
          <div className="glass-card p-6">
            <label htmlFor="input" className="block text-sm font-medium text-surface-300 mb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-primary-400" />
                  Input Text
                </div>
                <span className="text-xs text-surface-500">
                  {inputText?.length || 0} / 50,000
                </span>
              </div>
            </label>
            <textarea
              {...register('input')}
              id="input"
              rows={8}
              placeholder="Enter the text you want to process..."
              className={`w-full px-4 py-3 rounded-xl bg-surface-800/50 border text-surface-100 placeholder-surface-600 text-sm outline-none transition-all resize-y focus:ring-2 focus:ring-primary-500/30 ${
                errors.input ? 'border-red-500/50' : 'border-surface-700/50 focus:border-primary-500/50'
              }`}
            />
            {errors.input && (
              <p className="text-red-400 text-xs mt-1.5">{errors.input.message}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            id="create-task-submit-btn"
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>Create & Run Task <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateTask;
