import { useEffect, useCallback } from 'react';
import { getSupabase } from '../lib/supabase';

// VAPID public key - should be set in environment variables
// Tạo bằng: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = import.meta.env.VITE_WEBPUSH_VAPID_PUBLIC_KEY || '';

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

// Subscribe to push notifications
async function subscribeToPush(userId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    // Check for service worker support
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Web Push: Trình duyệt không hỗ trợ Push API');
      return null;
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/web-push-sw.js');

    // Get VAPID public key
    if (!VAPID_PUBLIC_KEY) {
      console.warn('Web Push: VAPID public key chưa được thiết lập (VITE_WEBPUSH_VAPID_PUBLIC_KEY)');
      return null;
    }

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY)
    });

    // Extract keys from subscription
    const keys = subscription.toJSON().keys;
    const endpoint = subscription.endpoint;
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      console.error('Web Push: Thiếu keys trong subscription');
      return null;
    }

    // Save to Supabase push_subscriptions table
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      platform: 'web'
    }, { onConflict: 'user_id' });

    if (error) {
      console.error('Web Push: Lỗi lưu subscription:', error);
      return null;
    }

    console.log('Web Push: Đăng ký thành công cho user', userId);
    return userId;
  } catch (err) {
    console.error('Web Push: Lỗi đăng ký:', err);
    return null;
  }
}

// Unsubscribe from push notifications
async function unsubscribeFromPush(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    // Delete from Supabase
    await supabase.from('push_subscriptions').delete().eq('user_id', userId);

    // Unsubscribe from push
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

export function useWebPush(userId: string | null) {
  // Register push subscription when user logs in
  useEffect(() => {
    if (!userId) return;

    const registerPush = async () => {
      await subscribeToPush(userId);
    };

    registerPush();

    // Cleanup on logout
    return () => {
      if (userId) {
        unsubscribeFromPush(userId);
      }
    };
  }, [userId]);

  // Request notification permission
  useEffect(() => {
    if (!userId) return;

    const requestPermission = async () => {
      if (!('Notification' in window)) return;

      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Web Push: Quyền thông báo được cấp');
      }
    };

    requestPermission();
  }, [userId]);
}