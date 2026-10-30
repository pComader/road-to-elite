// Configuración de Road To Elite. Nada de aquí es secreto:
// la seguridad la ponen el login con Google y la comprobación del token + email en el servidor (Apps Script).
window.APP_CONFIG = {
  firebase: {
    apiKey: "AIzaSyArN_Bk25gA6TnHYxOg5vv-tHVohHIhnZM",
    authDomain: "road-to-elite.firebaseapp.com",
    projectId: "road-to-elite",
    storageBucket: "road-to-elite.firebasestorage.app",
    messagingSenderId: "951102725046",
    appId: "1:951102725046:web:2092bce4805dd2ec273f17"
  },
  emailPermitido: "pabloserranolopez@gmail.com",
  apiUrl: "https://script.google.com/macros/s/AKfycbzAXPslG5m0E6ZkprL7Y79-lqnLfLtTLsgfas0TamMqDcWA0Ja12Nmk_BIlz_7c5kyC/exec",
  vapidKey: "BG62Mtf-5B9J0ve2hDaq89kJypyVx2C0pxZe1BcaNBEoKKEy0qNT0zdmiQxvM75UgR8nybEynfgKJaqMnkaEMTU",     // clave pública de avisos (Firebase › Cloud Messaging › Web Push). Es pública: puede ir aquí.
  diasSesion: 14   // sin abrir la app en 14 días → hay que volver a entrar
};
