importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Standard initialization relying on query params or pushing config.
// Ideally, the server pushes the config here, but typically firebase handles it natively 
// combined with the VAPID key on the frontend payload.

firebase.initializeApp({
  apiKey: "ignored",
  projectId: "ignored",
  messagingSenderId: "ignored",
  appId: "ignored",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'Emergency Alert';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/vite.svg',
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
