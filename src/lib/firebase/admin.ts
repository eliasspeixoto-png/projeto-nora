import admin from 'firebase-admin';

/**
 * Global Firebase Admin initialization.
 * This is designed to be safe to call multiple times and safe during Next.js build.
 */
function getOrInitApp() {
  // Check if the [DEFAULT] app is already initialized
  const apps = admin.apps;
  const defaultApp = apps.find(app => app?.name === '[DEFAULT]');
  if (defaultApp) return defaultApp;

  // If [DEFAULT] is missing, we must initialize it, even if 'firebase-frameworks' exists
  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'studio-2629657699-721b1';

  try {
    if (serviceAccountVar) {
      // Limpar possíveis aspas simples ou duplas que envolvem o JSON no .env.local
      const cleanedJson = serviceAccountVar.trim().replace(/^['"]|['"]$/g, '');
      
      if (cleanedJson.startsWith('{')) {
        const rawSA = JSON.parse(cleanedJson);
        
        console.log("🔥🔥🔥 [NORA-DIAGNOSTICO] INICIALIZANDO FIREBASE ADMIN (ARQUIVO CORRETO) 🔥🔥🔥");

        // Objeto de credenciais com mapeamento agressivo para evitar bugs de DNS/URL
        const serviceAccount: any = {
          projectId: rawSA.project_id || projectId,
          project_id: rawSA.project_id || projectId,
          privateKey: (rawSA.private_key || '').replace(/\\n/g, '\n'),
          private_key: (rawSA.private_key || '').replace(/\\n/g, '\n'),
          clientEmail: rawSA.client_email,
          client_email: rawSA.client_email,
          universe_domain: "googleapis.com"
        };

        return admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.projectId,
        });
      }
    }
    
    // Se não houver service account var ou formato inválido, tenta o default
    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: projectId,
    });
  } catch (e: any) {
    if (process.env.NODE_ENV === 'production') {
      console.error('CRITICAL: Failed to initialize Firebase Admin SDK in production:', e.message);
      console.error('Check if FIREBASE_SERVICE_ACCOUNT is correct and NEXT_PUBLIC_FIREBASE_PROJECT_ID is defined.');
    } else {
      console.warn('Firebase Admin SDK initialization skipped or failed (likely missing env vars during build):', e.message);
    }
    return null;
  }
}


// Proxied exports that initialize on first access
export const firestore = new Proxy({} as admin.firestore.Firestore, {
  get(_, prop) {
    const app = getOrInitApp();
    if (!app) {
      console.error(`Attempted to access firestore.${String(prop)} but Firebase Admin is not initialized.`);
      // Return a dummy that doesn't crash evaluation but will fail on actual calls
      return () => { throw new Error(`Firebase Admin not initialized. Cannot call ${String(prop)}`); };
    }
    return (admin.firestore() as any)[prop];
  }
});

export const auth = new Proxy({} as admin.auth.Auth, {
  get(_, prop) {
    const app = getOrInitApp();
    if (!app) {
      console.error(`Attempted to access auth.${String(prop)} but Firebase Admin is not initialized.`);
      return () => { throw new Error(`Firebase Admin not initialized. Cannot call ${String(prop)}`); };
    }
    return (admin.auth() as any)[prop];
  }
});

export const storage = new Proxy({} as admin.storage.Storage, {
  get(_, prop) {
    const app = getOrInitApp();
    if (!app) {
       console.error(`Attempted to access storage.${String(prop)} but Firebase Admin is not initialized.`);
       return () => { throw new Error(`Firebase Admin not initialized. Cannot call ${String(prop)}`); };
    }
    return (admin.storage() as any)[prop];
  }
});

export const messaging = new Proxy({} as admin.messaging.Messaging, {
  get(_, prop) {
    const app = getOrInitApp();
    if (!app) {
      console.error(`Attempted to access messaging.${String(prop)} but Firebase Admin is not initialized.`);
      return () => { throw new Error(`Firebase Admin not initialized. Cannot call ${String(prop)}`); };
    }
    return (admin.messaging() as any)[prop];
  }
});
