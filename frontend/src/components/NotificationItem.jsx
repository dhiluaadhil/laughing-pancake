import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Avatar from './Avatar';
import api from '../api/axios';

const TYPE_LABELS = {
  like:            '❤️ liked your post',
  comment:         '💬 commented on your post',
  follow:          '👥 started following you',
  follow_request:  '✋ requested to follow you',
  follow_accepted: '✅ accepted your follow request',
};

export default function NotificationItem({ notif }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const acceptMutation = useMutation({
    mutationFn: () => api.post(`/follows/accept/${notif.actor_id}`),
    onSuccess: () => {
      toast.success('Request accepted');
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const declineMutation = useMutation({
    mutationFn: () => api.post(`/follows/decline/${notif.actor_id}`),
    onSuccess: () => {
      toast.success('Request declined');
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const handleClick = (e) => {
    // Don't navigate if clicking buttons
    if (e.target.closest('button')) return;
    if (notif.post_id) navigate(`/post/${notif.post_id}`);
    else navigate(`/profile/${notif.actor_username}`);
  };

  return (
    <div
      className={`notif-item ${!notif.read ? 'unread' : ''} fade-in`}
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    >
      {!notif.read && (
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--accent)', flexShrink: 0, marginTop: 6,
        }} />
      )}
      <Avatar src={notif.actor_avatar} username={notif.actor_username} size={40} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
          <span className="font-bold">@{notif.actor_username}</span>
          {' '}{TYPE_LABELS[notif.type] || 'interacted with you'}
        </p>
        <p className="text-muted text-sm" style={{ marginTop: 2 }}>
          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
        </p>
        
        {notif.type === 'follow_request' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
            >
              Accept
            </button>
            <button 
              className="btn btn-ghost btn-sm"
              onClick={() => declineMutation.mutate()}
              disabled={declineMutation.isPending}
            >
              Decline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
