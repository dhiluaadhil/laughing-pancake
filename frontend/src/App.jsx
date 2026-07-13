import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { useSocket } from './hooks/useSocket';
import { useState } from 'react';

// Pages
import Register     from './pages/Register';
import Login        from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Home         from './pages/Home';
import Profile      from './pages/Profile';
import PostDetail   from './pages/PostDetail';
import AdminDashboard from './pages/AdminDashboard';
import AdminRoute from './components/AdminRoute';
import Clubs        from './pages/Clubs';
import ClubDetail   from './pages/ClubDetail';
import Search       from './pages/Search';
import Notifications from './pages/Notifications';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// Inner component so it can use AuthContext for socket
function AppInner() {
  const [unreadCount, setUnreadCount] = useState(0);

  useSocket((notif) => {
    setUnreadCount((c) => c + 1);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  });

  return (
    <Routes>
      {/* Public */}
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Protected */}
      <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/profile/:username" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/post/:id" element={<ProtectedRoute><PostDetail /></ProtectedRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/clubs"    element={<ProtectedRoute><Clubs /></ProtectedRoute>} />
      <Route path="/clubs/:id" element={<ProtectedRoute><ClubDetail /></ProtectedRoute>} />
      <Route path="/search"   element={<ProtectedRoute><Search /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications unreadCount={unreadCount} setUnreadCount={setUnreadCount} /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" />
          <AppInner />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
