import { useState, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiImage, FiSend } from 'react-icons/fi';
import Sidebar from '../components/Sidebar';
import PostCard from '../components/PostCard';
import Avatar from '../components/Avatar';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { FiInbox, FiStar, FiZap, FiGrid } from 'react-icons/fi';

/* ── Right sidebar: suggested clubs ── */
function RightSidebar() {
  const { data: clubs = [] } = useQuery({
    queryKey: ['suggested-clubs'],
    queryFn: () => api.get('/clubs/user/suggested').then((r) => r.data),
  });
  const qc = useQueryClient();
  const joinMutation = useMutation({
    mutationFn: (id) => api.post(`/clubs/${id}/join`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suggested-clubs'] }),
  });

  return (
    <aside className="right-sidebar">
      <div className="card">
        <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiGrid /> Clubs you might like
        </h3>
        {clubs.length === 0 && (
          <p className="text-muted text-sm">No suggestions right now</p>
        )}
        {clubs.map((club) => (
          <div key={club.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 0', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Link to={`/clubs/${club.id}`} className="font-bold truncate" style={{ fontSize: '0.875rem', display: 'block' }}>
                {club.name}
              </Link>
              <p className="text-muted text-sm">{club.member_count} members</p>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => joinMutation.mutate(club.id)}
              disabled={joinMutation.isPending}
            >
              Join
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}

/* ── Compose box ── */
function ComposeBox({ onPost }) {
  const { user } = useAuth();
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState(null);
  const fileRef = useRef();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (formData) => api.post('/posts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    onSuccess: () => {
      setCaption('');
      setImage(null);
      qc.invalidateQueries({ queryKey: ['feed'] });
      toast.success('Post published!');
      onPost?.();
    },
    onError: () => toast.error('Failed to publish post'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!caption.trim()) return;
    const fd = new FormData();
    fd.append('caption', caption.trim());
    if (image) fd.append('image', image);
    mutation.mutate(fd);
  };

  return (
    <div className="compose-box">
      <Avatar src={user?.avatar_url} username={user?.username} size={44} />
      <div className="compose-area">
        <form onSubmit={handleSubmit}>
          <textarea
            className="compose-input"
            placeholder="What's happening on campus?"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={2000}
            rows={2}
          />
          {image && (
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
              <img src={URL.createObjectURL(image)} alt="preview"
                style={{ maxHeight: 120, borderRadius: 8, border: '1px solid var(--border)' }} />
              <button type="button" onClick={() => setImage(null)} style={{
                position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)',
                color: '#fff', borderRadius: '50%', width: 22, height: 22, fontSize: 12,
              }}>✕</button>
            </div>
          )}
          <div className="compose-footer">
            <div style={{ display: 'flex', gap: 8 }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={(e) => setImage(e.target.files[0] || null)} />
              <button type="button" className="action-btn" onClick={() => fileRef.current?.click()}>
                <FiImage size={18} />
              </button>
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!caption.trim() || mutation.isPending}
            >
              <FiSend size={14} />
              {mutation.isPending ? 'Posting…' : 'Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Latest Feed ── */
function LatestFeed() {
  const { data, fetchNextPage, hasNextPage, isLoading, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['feed', 'latest'],
    queryFn: ({ pageParam }) =>
      api.get('/feed/latest', { params: pageParam ? { cursor: pageParam } : {} }).then((r) => r.data),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
  });

  const posts = data?.pages.flatMap((p) => p.posts) ?? [];

  if (isLoading) return <div className="spinner" />;
  if (posts.length === 0) return (
    <div className="empty-state">
      <div className="icon"><FiInbox /></div>
      <h3>No posts yet</h3>
      <p>Be the first to post something!</p>
    </div>
  );

  return (
    <div>
      {posts.map((post) => <PostCard key={post.id} post={post} />)}
      {hasNextPage && (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <button className="btn btn-ghost" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── For You Feed ── */
function ForYouFeed() {
  const { data, fetchNextPage, hasNextPage, isLoading, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['feed', 'foryou'],
    queryFn: ({ pageParam = 0 }) =>
      api.get('/feed/foryou', { params: { offset: pageParam } }).then((r) => r.data),
    getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
    initialPageParam: 0,
  });

  const posts = data?.pages.flatMap((p) => p.posts) ?? [];

  if (isLoading) return <div className="spinner" />;
  if (posts.length === 0) return (
    <div className="empty-state">
      <div className="icon"><FiStar /></div>
      <h3>Your feed is empty</h3>
      <p>Follow people or add more interests to see personalized content</p>
    </div>
  );

  return (
    <div>
      {posts.map((post) => <PostCard key={post.id} post={post} />)}
      {hasNextPage && (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <button className="btn btn-ghost" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Home Page ── */
export default function Home({ unreadCount = 0 }) {
  const [tab, setTab] = useState('latest');

  return (
    <div className="page-layout">
      <Sidebar unreadCount={unreadCount} />

      <main className="main-content">
        <div className="page-header">
          <h2>Home</h2>
        </div>

        <ComposeBox />

        <div className="tabs">
          <button className={`tab-btn ${tab === 'latest' ? 'active' : ''}`} onClick={() => setTab('latest')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <FiZap /> Latest
          </button>
          <button className={`tab-btn ${tab === 'foryou' ? 'active' : ''}`} onClick={() => setTab('foryou')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <FiStar /> For You
          </button>
        </div>

        {tab === 'latest' ? <LatestFeed /> : <ForYouFeed />}
      </main>

      <RightSidebar />
    </div>
  );
}
