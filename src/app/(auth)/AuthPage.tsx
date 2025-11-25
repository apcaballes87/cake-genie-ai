import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { showSuccess, showError } from '../../lib/utils/toast';
import { BackIcon, Loader2 } from '../../components/icons';
import { getSupabaseClient } from '../../lib/supabase/client';

const supabase = getSupabaseClient();

interface AuthPageProps {
  onClose: () => void;
  onSuccess: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onClose, onSuccess }) => {
  const [authTab, setAuthTab] = useState<'login' | 'signup' | 'forgot_password'>('login');
  const { signIn, signUp } = useAuth();

  // --- Login Form State ---
  const [emailLogin, setEmailLogin] = useState('');
  const [passwordLogin, setPasswordLogin] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingLogin(true);

    try {
      // Get current anonymous user ID BEFORE logging in
      const { data: { user: anonymousUser } } = await supabase.auth.getUser();
      const anonymousUserId = anonymousUser?.id;
      const wasAnonymous = anonymousUser?.is_anonymous || false;

      // Perform login
      const { data, error } = await signIn({
        email: emailLogin,
        password: passwordLogin
      });

      if (error) throw error;

      // If user was anonymous and had a session, merge their cart
      if (wasAnonymous && anonymousUserId && data.user) {
        // Import the merge function
        const { mergeAnonymousCartToUser } = await import('../../services/supabaseService');

        const mergeResult = await mergeAnonymousCartToUser(anonymousUserId, data.user.id);

        if (mergeResult.success) {
          showSuccess('Welcome back! Your cart has been restored.');
        } else {
          showSuccess('Welcome back!');
        }
      } else {
        showSuccess('Welcome back!');
      }

      onSuccess();
    } catch (error: any) {
      showError(error.message || 'An unknown error occurred.');
    } finally {
      setLoadingLogin(false);
    }
  };

  // --- SignUp Form State ---
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [emailSignUp, setEmailSignUp] = useState('');
  const [passwordSignUp, setPasswordSignUp] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingSignUp, setLoadingSignUp] = useState(false);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (passwordSignUp !== confirmPassword) {
      showError('Passwords do not match.');
      return;
    }

    setLoadingSignUp(true);
    try {
      const { data, error } = await signUp({
        email: emailSignUp,
        password: passwordSignUp
      }, {
        first_name: firstName,
        last_name: lastName
      });
      if (error) throw error;
      showSuccess('Account created successfully! Please check your email to verify your account.');
      onSuccess();
    } catch (error: any) {
      showError(error.message || 'An unknown error occurred.');
    } finally {
      setLoadingSignUp(false);
    }
  };

  // --- Forgot Password Form State ---
  const [emailForgot, setEmailForgot] = useState('');
  const [loadingForgot, setLoadingForgot] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingForgot(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailForgot, {
        redirectTo: `${window.location.origin}/#/auth/set-password`,
      });

      if (error) throw error;

      showSuccess('Password reset link sent! Please check your email.');
      setAuthTab('login');
    } catch (error: any) {
      showError(error.message || 'An unknown error occurred.');
    } finally {
      setLoadingForgot(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <button
        onClick={onClose}
        className="absolute top-6 left-6 p-2 rounded-full bg-white/80 backdrop-blur hover:bg-white transition-colors shadow-md z-10"
        aria-label="Go back"
      >
        <BackIcon className="w-6 h-6 text-gray-700" />
      </button>

      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text mb-6">
          {authTab === 'login' ? 'Welcome Back!' : 'Create Account'}
        </h2>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-6 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setAuthTab('login')}
            className={`flex-1 py-2 rounded-md font-medium transition-all ${authTab === 'login'
              ? 'bg-white shadow text-purple-600'
              : 'text-gray-600 hover:text-purple-600'
              }`}
          >
            Login
          </button>
          <button
            onClick={() => setAuthTab('signup')}
            className={`flex-1 py-2 rounded-md font-medium transition-all ${authTab === 'signup'
              ? 'bg-white shadow text-purple-600'
              : 'text-gray-600 hover:text-purple-600'
              }`}
          >
            Sign Up
          </button>
        </div>

        {/* Login Form */}
        {authTab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={emailLogin}
                onChange={(e) => setEmailLogin(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="your@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={passwordLogin}
                onChange={(e) => setPasswordLogin(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
              <div className="flex justify-end mt-1">
                <button
                  type="button"
                  onClick={() => setAuthTab('forgot_password')}
                  className="text-xs text-purple-600 hover:text-purple-800 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loadingLogin}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingLogin ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>
        )}

        {/* Signup Form */}
        {authTab === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="John"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Doe"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={emailSignUp}
                onChange={(e) => setEmailSignUp(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="your@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={passwordSignUp}
                onChange={(e) => setPasswordSignUp(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loadingSignUp}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingSignUp ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        )}

        {/* Forgot Password Form */}
        {authTab === 'forgot_password' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={emailForgot}
                onChange={(e) => setEmailForgot(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="your@email.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loadingForgot}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingForgot ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending link...
                </>
              ) : (
                'Send Reset Link'
              )}
            </button>
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => setAuthTab('login')}
                className="text-sm text-purple-600 hover:text-purple-800 hover:underline"
              >
                Back to Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthPage;