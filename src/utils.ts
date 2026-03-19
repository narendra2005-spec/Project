import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function notifyUser(title: string, body: string, type: 'success' | 'error' | 'info' = 'success') {
  if ('vibrate' in navigator) {
    if (type === 'error') {
      navigator.vibrate([50, 50, 50]);
    } else if (type === 'success') {
      navigator.vibrate([200]);
    } else {
      navigator.vibrate([100]);
    }
  }

  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(title, { body });
      }
    }
  }
}
