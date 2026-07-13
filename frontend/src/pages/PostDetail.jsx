import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiArrowLeft } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import Sidebar from '../components/Sidebar';
import CommentSection from '../components/CommentSection';
import Avatar from '../components/Avatar';
import PostCard from '../components/PostCard';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiTrash2 } from 'react-icons/fi';

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/posts/${id}`),
    onSuccess: () => {
      toast.success('Post deleted');
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      navigate(-1);
    },
  });

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', id],
    queryFn: () => api.get(`/posts/${id}`).then((r) => r.data),
  });

  if (isLoading) return (
    <div className="page-layout no-sidebar">
      <Sidebar />
      <main className="main-content loading-center"><div className="spinner" /></main>
    </div>
  );

  if (!post) return (
    <div className="page-layout no-sidebar">
      <Sidebar />
      <main className="main-content">
        <div className="empty-state"><h3>Post not found</h3></div>
      </main>
    </div>
  );

  return (
    <div className="page-layout no-sidebar">
      <Sidebar />
      <main className="main-content">
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="action-btn" onClick={() => navigate(-1)}>
            <FiArrowLeft size={20} />
          </button>
          <h2>Post</h2>
        </div>

        {/* Full post */}
        <div style={{ padding: 20, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate(`/profile/${post.username}`)}>
              <Avatar src={post.avatar_url} username={post.username} size={48} />
            </span>
            <div>
              <div className="font-bold" style={{ cursor: 'pointer' }} onClick={() => navigate(`/profile/${post.username}`)}>
                @{post.username}
              </div>
              <div className="text-muted text-sm">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </div>
            </div>
            {(user?.id === post.author_id || user?.role === 'admin') && (
              <button
                className="action-btn"
                onClick={() => deleteMutation.mutate()}
                title="Delete post"
                style={{ marginLeft: 'auto', color: 'var(--danger)' }}
              >
                <FiTrash2 size={18} />
              </button>
            )}
          </div>
          <p style={{ fontSize: '1.1rem', lineHeight: 1.7, marginBottom: 16, whiteSpace: 'pre-wrap' }}>
            {post.caption}
          </p>
          {post.image_url && (
            <img src={post.image_url} alt="Post" className="post-image" />
          )}
          {/* Like / share via PostCard style buttons */}
          <PostCard post={post} />
        </div>

        {/* Comments */}
        <div>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3>💬 Comments ({post.comment_count ?? 0})</h3>
          </div>
          <CommentSection postId={id} />
        </div>
      </main>
    </div>
  );
}
