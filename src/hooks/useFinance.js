import { useState, useEffect } from 'react'
import { db } from '../firebase/config'
import { 
  collection, query, where, onSnapshot, 
  orderBy, getDocs, limit, addDoc, doc, 
  updateDoc, deleteDoc, serverTimestamp 
} from 'firebase/firestore'

export function useFinance() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const billsRef = collection(db, 'billing')
    const q = query(billsRef, orderBy('dueDate', 'desc'))

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setBills(data)
      setLoading(false)
    }, (err) => {
      console.error('useFinance error:', err)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const overdueBills = bills.filter(b => b.status === 'overdue')
  const pendingBills = bills.filter(b => b.status === 'pending')
  const paidBills = bills.filter(b => b.status === 'paid')

  const totalOverdue = overdueBills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
  const totalPending = pendingBills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
  const totalPaid = paidBills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)

  async function addBill(billData) {
    const billsRef = collection(db, 'billing')
    await addDoc(billsRef, {
      ...billData,
      createdAt: serverTimestamp(),
      amount: Number(billData.amount)
    })
  }

  async function updateBillStatus(billId, newStatus) {
    const billRef = doc(db, 'billing', billId)
    const payload = { 
      status: newStatus,
      updatedAt: serverTimestamp()
    }
    if (newStatus === 'paid') {
      payload.paidAt = serverTimestamp()
    }
    await updateDoc(billRef, payload)
  }

  async function deleteBill(billId) {
    await deleteDoc(doc(db, 'billing', billId))
  }

  return {
    bills,
    loading,
    overdueCount: overdueBills.length,
    pendingCount: pendingBills.length,
    totalOverdue,
    totalPending,
    totalPaid,
    overdueBills,
    addBill,
    updateBillStatus,
    deleteBill
  }
}
