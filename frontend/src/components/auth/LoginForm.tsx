import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import type { AppRole } from '../../contexts/AuthContext';

export const LoginForm: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<AppRole>('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { isAuthenticated, role, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || !role) return;
    navigate(role === 'courier' ? '/courier-map' : '/orders', { replace: true });
  }, [isAuthenticated, role, navigate]);

  useEffect(() => {
    setError('');
    if (selectedRole === 'courier') {
      setUsername('');
      setPassword('');
    }
  }, [selectedRole]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedRole === 'courier') {
      if (login({ role: 'courier' })) {
        navigate('/courier-map');
        return;
      }
      setError('Unable to open courier view');
      return;
    }

    if (login({ role: 'admin', username, password })) {
      navigate('/orders');
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">Sign in to your account</h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedRole('admin')}
              className={`rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                selectedRole === 'admin'
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700'
              }`}
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole('courier')}
              className={`rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                selectedRole === 'courier'
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700'
              }`}
            >
              Courier
            </button>
          </div>

          {selectedRole === 'admin' ? (
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="username" className="sr-only">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 bg-white border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 bg-white border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-gray-700 bg-gray-800/80 px-4 py-3 text-center text-sm text-gray-200">
              Open the courier map in read-only mode.
            </div>
          )}

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {selectedRole === 'courier' ? 'Open courier view' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 