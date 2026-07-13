import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

/**
 * useSocket (now SSE-based — replaces socket.io-client).
 *
 * Connects to /api/notifications/stream via Server-Sent Events.
 * The JWT is passed as a ?token= query param because EventSource
 * cannot set custom Authorization headers.
 *
 * @param {function} onNotification - Callback invoked with each new notification
 */
export function useSocket(onNotification) {
  const { user } = useAuth();
  const callbackRef = useRef(onNotification);
  callbackRef.current = onNotification;
  const esRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('campuslink_token');

    if (!token) return;

    const url = `${API_URL}/api/notifications/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('notification', (event) => {
      try {
        const notif = JSON.parse(event.data);
        callbackRef.current?.(notif);

        const messages = {
          like:    `❤️ ${notif.actor_username} liked your post`,
          comment: `💬 ${notif.actor_username} commented on your post`,
          follow:  `👥 ${notif.actor_username} started following you`,
        };

        toast(messages[notif.type] || 'You have a new notification', {
          style: {
            background: '#1e1b4b',
            color: '#e0e7ff',
            border: '1px solid #4f46e5',
            borderRadius: '12px',
            padding: '12px 16px',
          },
          duration: 4000,
        });
      } catch { /* ignore parse errors */ }
    });

    es.addEventListener('error', () => {
      // EventSource auto-reconnects on error — no manual handling needed
    });

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [user]);

  return null; // No longer returning a socket instance (not needed)
}
