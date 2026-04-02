import { useState, useEffect } from 'react';
import { getStudentAttendanceStats } from '../dataconnect-generated';

/**
 * Hook to calculate attendance status and monthly progress for a student
 * @param {string} studentId
 */
export function useAttendanceAlerts(studentId, createdAtStrOrDate = null) {
  const [status, setStatus] = useState('loading'); // 'active', 'warning', 'critical', 'loading'
  const [lastAttendance, setLastAttendance] = useState(null);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [consecutiveMisses, setConsecutiveMisses] = useState(0); // For future logic
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;

    async function fetchData() {
      setIsLoading(true);
      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Fetch using the requested query
        const res = await getStudentAttendanceStats({ 
          studentId, 
          startOfMonth: startOfMonth.toISOString() 
        });

        const participations = res.data.eventParticipants || [];
        setMonthlyCount(participations.length);

        const lastDateStr = participations[0]?.registeredAt;
        const lastDate = lastDateStr ? new Date(lastDateStr) : null;
        setLastAttendance(lastDate);

        // Calculate status mapping
        if (!lastDate) {
          // Verify if they completely vanished or never came
          let isNew = false;
          if (createdAtStrOrDate) {
            const joined = new Date(createdAtStrOrDate);
            if (!isNaN(joined.getTime())) {
              const daysSinceJoin = (now - joined) / (1000 * 60 * 60 * 24);
              if (daysSinceJoin < 30) {
                isNew = true;
              }
            }
          }
          setStatus(isNew ? 'active' : 'critical');
        } else {
          const diffDays = (now - lastDate) / (1000 * 60 * 60 * 24);
          if (diffDays > 30) {
            setStatus('critical');
          } else if (diffDays > 14) {
            setStatus('warning');
          } else {
            setStatus('active');
          }
        }
      } catch (err) {
        console.error('Error fetching attendance alerts via getStudentAttendanceStats:', err);
        setStatus('error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [studentId]);

  return { status, lastAttendance, monthlyCount, consecutiveMisses, isLoading };
}
