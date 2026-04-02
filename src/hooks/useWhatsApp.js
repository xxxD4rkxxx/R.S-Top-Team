import { useState, useEffect } from 'react'
import { db } from '../firebase/config'
import { 
  collection, query, onSnapshot, 
  orderBy, addDoc, serverTimestamp 
} from 'firebase/firestore'

export function useWhatsApp() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const historyRef = collection(db, 'whatsapp_history')
    const q = query(historyRef, orderBy('sentAt', 'desc'))

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setHistory(data)
      setLoading(false)
    }, (err) => {
      console.error('useWhatsApp error:', err)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  async function logMessage(msgData) {
    const historyRef = collection(db, 'whatsapp_history')
    await addDoc(historyRef, {
      ...msgData,
      sentAt: serverTimestamp()
    })
  }

  return {
    history,
    loading,
    logMessage
  }
}
