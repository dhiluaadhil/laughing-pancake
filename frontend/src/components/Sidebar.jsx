import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import {
  FiHome, FiSearch, FiBell, FiUsers, FiUser,
  FiLogOut, FiPlusSquare, FiShield
} from 'react-icons/fi';

export default function LeftSidebar({ unreadCount = 0 }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/',              icon: <FiHome size={20} />,    label: 'Home' },
    { path: '/search',        icon: <FiSearch size={20} />,  label: 'Search' },
    { path: '/notifications', icon: <FiBell size={20} />,    label: 'Notifications', badge: unreadCount },
    { path: '/clubs',         icon: <FiUsers size={20} />,   label: 'Clubs' },
    { path: `/profile/${user?.username}`, icon: <FiUser size={20} />, label: 'Profile' },
  ];

  if (user?.role === 'admin') {
    navItems.push({ path: '/admin', icon: <FiShield size={20} />, label: 'Admin Panel' });
  }

  return (
    <>
      <aside className="sidebar">
      <Link to="/" className="nav-brand" style={{ display: 'block', padding: '4px 16px' }}>
        CampusLink
      </Link>

      <nav className="sidebar-nav">
        {navItems.map(({ path, icon, label, badge }) => (
          <Link
            key={path}
            to={path}
            className={`sidebar-link ${isActive(path) ? 'active' : ''}`}
          >
            {icon}
            <span>{label}</span>
            {badge > 0 && <span className="badge">{badge > 99 ? '99+' : badge}</span>}
          </Link>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: '24px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)', background: 'var(--bg-secondary)',
          marginTop: 16
        }}>
          <Avatar src={user?.avatar_url} username={user?.username} size={36} />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div className="font-bold truncate" style={{ fontSize: '0.875rem' }}>{user?.username}</div>
            <div className="text-muted truncate" style={{ fontSize: '0.75rem' }}>{user?.college}</div>
          </div>
          <button onClick={handleLogout} title="Logout" style={{ color: 'var(--text-muted)', padding: 4 }}>
            <FiLogOut size={16} />
          </button>
        </div>
      </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav">
        {navItems.map(({ path, icon, badge }) => (
          <Link
            key={path}
            to={path}
            className={`bottom-nav-link ${isActive(path) ? 'active' : ''}`}
          >
            {icon}
            {badge > 0 && <span className="badge">{badge > 99 ? '99+' : badge}</span>}
          </Link>
        ))}
      </nav>
    </>
  );
}
