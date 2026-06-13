import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCQKtn7p_emXwlkU8vnleLt6by28BRdr44",
  authDomain: "arogya-raksha-b43a5.firebaseapp.com",
  projectId: "arogya-raksha-b43a5",
  storageBucket: "arogya-raksha-b43a5.firebasestorage.app",
  messagingSenderId: "5824182253",
  appId: "1:5824182253:web:81a014c4d95b9dcd8c19e4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  console.log("Querying ACTIVE sosRequests...");
  try {
    const q = query(collection(db, "sosRequests"), where("status", "==", "active"));
    const snap = await getDocs(q);
    console.log("Found active SOS requests:", snap.size);
    snap.forEach(doc => {
      console.log(doc.id, "=>", doc.data());
    });
  } catch (e) {
    console.error("Error reading from Firestore:", e);
  }
}

test();
