import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

export interface FirebaseRuntime {
	app: FirebaseApp;
	auth: Auth;
	db: Firestore;
}

let runtime: FirebaseRuntime | null = null;
let emulatorsConnected = false;

export function getFirebase(): FirebaseRuntime {
	if (runtime) return runtime;

	const config = {
		apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
		authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
		projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
		storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
		messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
		appId: import.meta.env.VITE_FIREBASE_APP_ID
	};

	if (!config.apiKey || !config.projectId || !config.appId) {
		throw new Error('Firebase configuration is missing. Set the VITE_FIREBASE_* environment variables.');
	}

	const app = getApps().length > 0 ? getApps()[0] : initializeApp(config);
	const auth = getAuth(app);
	const db = getFirestore(app);

	if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' && !emulatorsConnected) {
		const authPort = Number(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT || 9099);
		const firestorePort = Number(import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT || 8085);
		connectAuthEmulator(auth, `http://127.0.0.1:${authPort}`, { disableWarnings: true });
		connectFirestoreEmulator(db, '127.0.0.1', firestorePort);
		emulatorsConnected = true;
	}

	runtime = {
		app,
		auth,
		db
	};

	return runtime;
}
