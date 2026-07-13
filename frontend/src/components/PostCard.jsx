import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { FiHeart, FiMessageCircle, FiShare2, FiTrash2 } from 'react-icons/fi';
import Avatar from './Avatar';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function PostCard({ post, onDelete }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const likeMutation = useMutation({
    mutationFn: () =>
      post.liked
        ? api.delete(`/likes/${post.id}`)
        : api.post(`/likes/${post.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post', post.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/posts/${post.id}`),
    onSuccess: () => {
      toast.success('Post deleted');
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      onDelete?.();
    },
  });

  const handleShare = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
    toast.success('Link copied!');
  };

  const handleCardClick = () => navigate(`/post/${post.id}`);
  const handleUsernameClick = (e) => {
    e.stopPropagation();
    navigate(`/profile/${post.username}`);
  };

  return (
    <article className="post-card fade-in" onClick={handleCardClick}>
      <div className="post-header">
        <span onClick={handleUsernameClick} style={{ cursor: 'pointer' }}>
          <Avatar src={post.avatar_url} username={post.username} size={44} />
        </span>
        <div className="post-meta">
          <div className="post-username" onClick={handleUsernameClick}>
            @{post.username}
          </div>
          <div className="post-time">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </div>
        </div>
        {(user?.id === post.author_id || user?.role === 'admin') && (
          <button
            className="action-btn"
            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(); }}
            title="Delete post"
            style={{ marginLeft: 'auto' }}
          >
            <FiTrash2 size={15} />
          </button>
        )}
      </div>

      <p className="post-caption">{post.caption}</p>

      {post.image_url && (
        <img src={post.image_url} alt="Post" className="post-image" />
      )}

      <div className="post-actions">
        <button
          className={`action-btn ${post.liked ? 'liked' : ''}`}
          onClick={(e) => { e.stopPropagation(); likeMutation.mutate(); }}
        >
          <FiHeart size={16} fill={post.liked ? 'currentColor' : 'none'} />
          <span>{post.like_count ?? 0}</span>
        </button>

        <button className="action-btn" onClick={handleCardClick}>
          <FiMessageCircle size={16} />
          <span>{post.comment_count ?? 0}</span>
        </button>

        <button className="action-btn" onClick={handleShare}>
          <FiShare2 size={16} />
        </button>
      </div>
    </article>
  );
}
