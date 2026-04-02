
import { db } from './src/firebase/config.js';
import { collection, addDoc, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

async function seedTestData() {
  console.log('Seeding test data for highlights and history...');

  // 1. Add some past sessions
  const sessionsRef = collection(db, 'sessions');
  const sessionData = [
    { modality: 'Jiu-Jitsu', time: '10:00', professor: 'Prof. Robson', date: new Date().toISOString().slice(0, 10), createdAt: serverTimestamp() },
    { modality: 'Boxe', time: '18:00', professor: 'Prof. Anderson', date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), createdAt: serverTimestamp() },
  ];

  for (const s of sessionData) {
    await addDoc(sessionsRef, s);
    console.log('Added session:', s.modality);
  }

  // 2. Update some students to trigger highlights
  const studentsSnap = await getDocs(collection(db, 'students'));
  const docs = studentsSnap.docs;

  if (docs.length >= 3) {
    // Student 1: Birthday today
    const bday = new Date();
    await updateDoc(doc(db, 'students', docs[0].id), {
      birthday: bday,
      name: docs[0].data().name + ' (Bday)'
    });
    console.log('Set birthday highlight for:', docs[0].data().name);

    // Student 2: Medical exam expiring soon (5 days from now)
    const medDate = new Date();
    medDate.setDate(medDate.getDate() + 5);
    await updateDoc(doc(db, 'students', docs[1].id), {
      medicalExamDate: medDate,
      name: docs[1].data().name + ' (Med Warning)'
    });
    console.log('Set medical warning for:', docs[1].data().name);

    // Student 3: Promotion ready (4 stripes)
    await updateDoc(doc(db, 'students', docs[2].id), {
      stripes: 4,
      name: docs[2].data().name + ' (Promo Ready)'
    });
    console.log('Set promotion readiness for:', docs[2].data().name);
  }

  console.log('Done!');
  process.exit(0);
}

seedTestData();
