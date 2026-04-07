import { db } from '../firebase/config'
import { doc, setDoc } from 'firebase/firestore'

const BELT_CONFIGS = {
  white: { label: 'Branca', color: '#FFFFFF', textColor: '#111111', next: 'blue', stripes: 0 },
  blue: { label: 'Azul', color: '#1E40AF', textColor: '#FFFFFF', next: 'purple', stripes: 0 },
  purple: { label: 'Roxa', color: '#6B21A8', textColor: '#FFFFFF', next: 'brown', stripes: 0 },
  brown: { label: 'Marrom', color: '#78350F', textColor: '#FFFFFF', next: 'black', stripes: 0 },
  black: { label: 'Preta', color: '#111111', textColor: '#FDE047', next: 'none', stripes: 0 }
}

async function seedBelts() {
  console.log('Seeding belts to Firestore...')
  for (const [id, config] of Object.entries(BELT_CONFIGS)) {
    await setDoc(doc(db, 'tech_journey_belts', id), config)
  }
  console.log('Success!')
}

seedBelts()
