// lib/utils/toast.ts
import toast, { ToastOptions } from 'react-hot-toast';

/**
 * Displays a success toast notification with a consistent style.
 * @param message The message to display.
 */
export const showSuccess = (message: string, options?: ToastOptions) => {
  toast.success(message, {
    duration: 3000,
    position: 'top-center',
    style: {
      background: '#10B981', // Green-500
      color: '#ffffff',
    },
    ...options,
  });
};

/**
 * Displays an error toast notification with a consistent style.
 * @param message The message to display.
 */
export const showError = (message: string, options?: ToastOptions) => {
  toast.error(message, {
    duration: 4000,
    position: 'top-center',
    style: {
      background: '#EF4444', // Red-500
      color: '#ffffff',
    },
    ...options,
  });
};

/**
 * Displays a loading toast notification and returns its ID.
 * @param message The message to display.
 * @returns The ID of the toast, which can be used to dismiss it later.
 */
export const showLoading = (message: string, options?: ToastOptions): string => {
  return toast.loading(message, {
    position: 'top-center',
    ...options,
  });
};

/**
 * Displays an informational toast notification.
 * @param message The message to display.
 */
export const showInfo = (message: string, options?: ToastOptions) => {
  toast(message, {
    duration: 4000,
    position: 'top-center',
    icon: 'ℹ️',
    style: {
      background: '#3B82F6', // Blue-500
      color: '#ffffff',
    },
    ...options,
  });
};