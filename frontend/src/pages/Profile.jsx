import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiArrowLeft, FiEdit2, FiUserPlus, FiUserMinus, FiMapPin, FiEdit3 } from 'react-icons/fi';
import Sidebar from '../components/Sidebar';
import PostCard from '../components/PostCard';
import Avatar from '../components/Avatar';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => api.get(`/users/${username}`).then((r) => r.data),
  });

  const { data: posts = [] } = useQuery({
    queryKey: ['user-posts', username],
    queryFn: () => api.get(`/users/${username}/posts`).then((r) => r.data),
    enabled: !!profile,
  });

  const { data: followCheck } = useQuery({
    queryKey: ['follow-check', profile?.id],
    queryFn: () => api.get(`/follows/check/${profile.id}`).then((r) => r.data),
    enabled: !!profile && profile.id !== me?.id,
  });

  const followMutation = useMutation({
    mutationFn: () =>
      (followCheck?.status === 'accepted' || followCheck?.status === 'pending')
        ? api.delete(`/follows/${profile.id}`)
        : api.post(`/follows/${profile.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['follow-check', profile?.id] });
      qc.invalidateQueries({ queryKey: ['profile', username] });
    },
  });

  const editMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('bio', bio);
      if (avatarFile) fd.append('avatar', avatarFile);
      return api.put('/users/me', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['profile', username] });
      setShowEdit(false);
      toast.success('Profile updated!');
    },
    onError: () => toast.error('Update failed'),
  });

  const isMe = me?.username === username;

  if (isLoading) return (
    <div className="page-layout no-sidebar">
      <Sidebar />
      <main className="main-content loading-center"><div className="spinner" /></main>
    </div>
  );

  if (!profile) return (
    <div className="page-layout no-sidebar">
      <Sidebar />
      <main className="main-content">
        <div className="empty-state"><h3>User not found</h3></div>
      </main>
    </div>
  );

  return (
    <div className="page-layout no-sidebar">
      <Sidebar />
      <main className="main-content">
        {/* Header */}
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="action-btn" onClick={() => navigate(-1)}>
            <FiArrowLeft size={20} />
          </button>
          <div>
            <h2 style={{ lineHeight: 1 }}>@{profile.username}</h2>
            <p className="text-muted text-sm">{profile.post_count} posts</p>
          </div>
        </div>

        {/* Banner + Avatar */}
        <div className="profile-banner">
          <div className="profile-avatar-wrap">
            <Avatar src={profile.avatar_url} username={profile.username} size={80} />
          </div>
        </div>

        {/* Profile info */}
        <div className="profile-info-section">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            {isMe ? (
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowEdit(!showEdit); setBio(profile.bio || ''); }}>
                <FiEdit2 size={14} /> Edit Profile
              </button>
            ) : (
              <button
                className={`btn btn-sm ${followCheck?.status === 'none' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => followMutation.mutate()}
                disabled={followMutation.isPending}
              >
                {followCheck?.status === 'accepted' ? <><FiUserMinus size={14} /> Unfollow</> :
                 followCheck?.status === 'pending'  ? <><FiUserMinus size={14} /> Requested</> :
                 <><FiUserPlus size={14} /> Follow</>}
              </button>
            )}
          </div>

          <h2 style={{ fontSize: '1.2rem' }}>@{profile.username}</h2>
          {profile.college && <p className="text-muted text-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FiMapPin size={12}/> {profile.college}</p>}
          {profile.bio && <p style={{ marginTop: 8, fontSize: '0.9rem' }}>{profile.bio}</p>}

          <div className="profile-stats" style={{ marginTop: 16 }}>
            <div className="profile-stat">
              <div className="num">{profile.post_count}</div>
              <div className="lbl">Posts</div>
            </div>
            <div className="profile-stat">
              <div className="num">{profile.follower_count}</div>
              <div className="lbl">Followers</div>
            </div>
            <div className="profile-stat">
              <div className="num">{profile.following_count}</div>
              <div className="lbl">Following</div>
            </div>
          </div>

          {/* Edit form */}
          {showEdit && (
            <div className="card fade-in" style={{ marginTop: 20 }}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Bio</label>
                <textarea className="form-input" value={bio} onChange={(e) => setBio(e.target.value)} style={{ minHeight: 70 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Avatar</label>
                <input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files[0])} style={{ color: 'var(--text-secondary)' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
                  {editMutation.isPending ? 'Saving…' : 'Save'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowEdit(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Posts */}
        <div>
          {posts.length === 0 ? (
            <div className="empty-state">
              <div className="icon"><FiEdit3 /></div>
              <h3>No posts yet</h3>
              {isMe && <p>Share your first post!</p>}
            </div>
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </div>
      </main>
    </div>
  );
}
