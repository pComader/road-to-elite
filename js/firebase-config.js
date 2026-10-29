// Configuración pública de Firebase (no es secreta: va siempre en el cliente).
// La seguridad la ponen: login con Google + verificación del token y del email
// en el servidor (Apps Script) + clave restringida al dominio de la app.
export const firebaseConfig = {
  apiKey: "AIzaSyArN_Bk25gA6TnHYxOg5vv-tHVohHIhnZM",
  authDomain: "road-to-elite.firebaseapp.com",
  projectId: "road-to-elite",
  storageBucket: "road-to-elite.firebasestorage.app",
  messagingSenderId: "951102725046",
  appId: "1:951102725046:web:2092bce4805dd2ec273f17"
};

// Única cuenta con acceso a la app (la del Drive). Se comprueba también en el servidor.
export const ALLOWED_EMAIL = "pabloserranolopez@gmail.com";

// URL del Apps Script publicado como aplicación web (v0.1, 29/10/2026).
export const API_URL = "https://script.google.com/macros/s/AKfycbzAXPslG5m0E6ZkprL7Y79-lqnLfLtTLsgfas0TamMqDcWA0Ja12Nmk_BIlz_7c5kyC/exec";
