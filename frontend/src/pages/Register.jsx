import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '../schemas/auth';
import { useAuth } from '../context/AuthContext';
import { Cpu, Mail, Lock, User, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

const Register = () => {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (data) => {
    try {
      setServerError('');
      await registerUser(data.name, data.email, data.password);
      navigate('/dashboard');
    } catch (err) {
      setServerError(
        err.response?.data?.message || 'Registration failed. Please try again.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 bg-mesh flex items-center justify-center p-4">
      <div className="absolute top-20 right-20 w-72 h-72 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-primary-500/8 rounded-full blur-[150px] pointer-events-none" />

      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-xl shadow-primary-500/25 animate-float">
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold gradient-text">AI Tasks</h1>
            <p className="text-xs text-surface-500 tracking-wider uppercase">Processing Platform</p>
          </div>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-surface-100">Create an account</h2>
            <p className="text-surface-400 text-sm mt-1">Start processing AI tasks today</p>
          </div>

          {serverError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-surface-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                <input
                  {...register('name')}
                  type="text"
                  id="name"
                  placeholder="John Doe"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl bg-surface-800/50 border text-surface-100 placeholder-surface-600 text-sm outline-none transition-all focus:ring-2 focus:ring-primary-500/30 ${
                    errors.name ? 'border-red-500/50' : 'border-surface-700/50 focus:border-primary-500/50'
                  }`}
                />
              </div>
              {errors.name && (
                <p className="text-red-400 text-xs mt-1.5">{errors.name.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-surface-300 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                <input
                  {...register('email')}
                  type="email"
                  id="email"
                  placeholder="you@example.com"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl bg-surface-800/50 border text-surface-100 placeholder-surface-600 text-sm outline-none transition-all focus:ring-2 focus:ring-primary-500/30 ${
                    errors.email ? 'border-red-500/50' : 'border-surface-700/50 focus:border-primary-500/50'
                  }`}
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-surface-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                <input
                  {...register('password')}
                  type="password"
                  id="password"
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl bg-surface-800/50 border text-surface-100 placeholder-surface-600 text-sm outline-none transition-all focus:ring-2 focus:ring-primary-500/30 ${
                    errors.password ? 'border-red-500/50' : 'border-surface-700/50 focus:border-primary-500/50'
                  }`}
                />
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-surface-300 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                <input
                  {...register('confirmPassword')}
                  type="password"
                  id="confirmPassword"
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl bg-surface-800/50 border text-surface-100 placeholder-surface-600 text-sm outline-none transition-all focus:ring-2 focus:ring-primary-500/30 ${
                    errors.confirmPassword ? 'border-red-500/50' : 'border-surface-700/50 focus:border-primary-500/50'
                  }`}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-red-400 text-xs mt-1.5">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              id="register-submit-btn"
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 mt-6"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Create Account <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-surface-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
