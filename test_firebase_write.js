import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

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
  console.log("Writing test SOS request...");
  try {
    const payload = {
      victimId: "test-user-id",
      status: "active",
      severity: "critical",
      source: "mobile",
      countdown: 0,
      location: { lat: 26.812, lon: 81.013 }, // Lucknow
      hasValidLocation: true,
      isApproximate: false,
      radiusKm: 5,
      helpersAssigned: [],
      helpersAccepted: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      victimBrief: { name: "Agent Test" }
    };
    const ref = await addDoc(collection(db, "sosRequests"), payload);
    console.log("✅ Successfully wrote SOS! ID:", ref.id);
  } catch (e) {
    console.error("❌ Error writing to Firestore:", e);
  }
}

test();
