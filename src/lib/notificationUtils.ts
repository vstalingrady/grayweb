const isNotificationSupported = () =>
  typeof window !== "undefined" && typeof Notification !== "undefined";

export const requestNotificationPermission = async (): Promise<NotificationPermission | null> => {
  if (!isNotificationSupported()) {
    return null;
  }
  if (Notification.permission !== "default") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch (error) {
    console.error("Notification permission request failed:", error);
    return null;
  }
};
