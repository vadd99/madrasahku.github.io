// Import SDK Firebase dari CDN Google
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Masukkan konfigurasi yang kamu dapatkan dari LANGKAH 3 di sini:
const firebaseConfig = {
    apiKey: "AIzaSyDKcmmQJtmzf3Zk_2tC_94LtJg6vrL5kic",
    authDomain: "madrasah-al-hadi.firebaseapp.com",
    projectId: "madrasah-al-hadi",
    storageBucket: "madrasah-al-hadi.firebasestorage.app",
    messagingSenderId: "863555475538",
    appId: "1:863555475538:web:09f3a3167b7e5d317da78b"
};
// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, getDocs, addDoc, updateDoc, deleteDoc, doc };
