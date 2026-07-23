import { useEffect } from 'react';
import { getSupabase } from '../lib/supabase';

// VAPID public key
const VAPID_PUBLIC_KEY = import.meta.env.VITE_WEBPUSH_VAPID_PUBLIC_KEY || '';

// sessionStorage key to track this device's subscription endpoint
const PUSH_ENDPOINT_KEY = 'hl_push_endpoint';

// Convert base64 URL-safe string to ArrayBuffer
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

// ─── Core subscribe/unsubscribe ─────────────────────────────────────────────

async function subscribeToPush(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Web Push: Trình duyệt không hỗ trợ Push API');
      return;
    }

    const registration = await navigator.serviceWorker.register('/web-push-sw.js');

    if (!VAPID_PUBLIC_KEY) {
      console.warn('Web Push: VAPID public key chưa được thiết lập');
      return;
    }

    // Request notification permission
    if ('Notification' in window && Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Web Push: Người dùng từ chối cấp quyền thông báo');
        return;
      }
    }

    // Get existing subscription
    let subscription = await registration.pushManager.getSubscription();

    // Subscribe if none exists
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
      });
    }

    const keys = subscription.toJSON().keys;
    const endpoint = subscription.endpoint;
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      console.error('Web Push: Thiếu keys trong subscription');
      return;
    }

    // Upsert based on endpoint — cùng thiết bị update, thiết bị khác insert mới
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      platform: 'web',
    }, { onConflict: 'endpoint' });

    if (error) {
      console.error('Web Push: Lỗi lưu subscription:', error);
      return;
    }

    sessionStorage.setItem(PUSH_ENDPOINT_KEY, endpoint);
    console.log('Web Push: Đăng ký thành công cho user', userId);
  } catch (err) {
    console.error('Web Push: Lỗi đăng ký:', err);
  }
}

// Unsubscribe from push notifications — chỉ xóa subscription của thiết bị này
async function unsubscribeFromPush(): Promise<void> {
  const supabase = getSupabase();

  try {
    // Xóa subscription của thiết bị hiện tại (theo endpoint)
    const currentEndpoint = sessionStorage.getItem(PUSH_ENDPOINT_KEY);

    if (supabase && currentEndpoint) {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', currentEndpoint);

      if (error) {
        console.error('Web Push: Lỗi xóa subscription:', error);
      } else {
        console.log('Web Push: Đã xóa subscription thiết bị hiện tại');
      }
      sessionStorage.removeItem(PUSH_ENDPOINT_KEY);
    }

    // Unsubscribe from browser push
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
    }
  } catch (err) {
    console.error('Web Push: Lỗi hủy đăng ký:', err);
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useWebPush(userId: string | null) {
  // Auto-subscribe when user logs in
  useEffect(() => {
    if (!userId) return;

    subscribeToPush(userId);

    // Cleanup on logout — chỉ xóa subscription thiết bị này
    return () => {
      unsubscribeFromPush();
    };
  }, [userId]);
}
