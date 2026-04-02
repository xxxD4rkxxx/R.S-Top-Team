import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase/config';
import {
  collection, query, where, getDocs,
  collectionGroup, orderBy, limit
} from 'firebase/firestore';
import { useStudents } from './useStudents';

// ── date helpers ─────────────────────────────────────────────
export function parseDate(d) {
  if (!d) return null;
  if (typeof d.toDate === 'function') return d.toDate();
  if (d instanceof Date) return d;
  const p = new Date(d);
  return isNaN(p.getTime()) ? null : p;
}

export function daysBetween(dateInput, base = new Date()) {
  const d = parseDate(dateInput);
  if (!d) return null;
  return Math.floor((base.getTime() - d.getTime()) / 86400000);
}

function toYMD(d) {
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
}

// ── main hook ────────────────────────────────────────────────
export function useDashboardStats(period = 'Semana') {
  const { students, isLoading: isLoadingStudents } = useStudents();

  const [data, setData] = useState({
    todayPresences: 0,
    chartData: [],          // { name, presencas, faltas }
    sessions: [],           // raw session docs for "Histórico"
    absentStudents: [],     // active students > 10 days without attendance
    retentionRate: 0,
    weekGrowth: 0,          // % vs previous period
    activeStudentsAlerts: { warning: 0, critical: 0 },
    teamStats: { total: 0, active: 0, byRole: {} }, // NEW
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (isLoadingStudents || !students) return;
    setLoading(true);
    try {
      const now    = new Date();
      const todayStr   = toYMD(now);
      const sessRef    = collection(db, 'sessions');

      // ── 1. Today's presences ─────────────────────────────
      const todaySnap = await getDocs(query(sessRef, where('date', '==', todayStr)));
      let todayPresences = 0;
      for (const s of todaySnap.docs) {
        const attSnap = await getDocs(collection(s.ref, 'attendances'));
        attSnap.forEach(a => { if (a.data().status === 'present') todayPresences++; });
      }

      // ── 2. Period bounds ─────────────────────────────────
      let rangeStart = new Date(now);
      let prevRangeStart = new Date(now);
      let labelFn; // day → chart label

      if (period === 'Semana') {
        rangeStart.setDate(now.getDate() - 6);
        prevRangeStart.setDate(now.getDate() - 13);
        // labels: Mon-Sun abbreviated
        const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
        labelFn = (dateStr) => {
          const d = new Date(`${dateStr}T12:00:00Z`);
          return DAYS[d.getDay()];
        };
      } else if (period === 'Mês') {
        rangeStart.setDate(1);
        prevRangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        labelFn = (dateStr) => dateStr.split('-')[2]; // day number
      } else { // Ano
        rangeStart = new Date(now.getFullYear(), 0, 1);
        prevRangeStart = new Date(now.getFullYear() - 1, 0, 1);
        const MNTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        labelFn = (dateStr) => {
          const d = new Date(`${dateStr}T12:00:00Z`);
          return MNTHS[d.getMonth()];
        };
      }

      const rangeStartStr    = toYMD(rangeStart);
      const prevRangeStartStr = toYMD(prevRangeStart);

      // Fetch both ranges in parallel
      const [currentSnap, prevSnap] = await Promise.all([
        getDocs(query(sessRef, where('date', '>=', rangeStartStr), where('date', '<=', todayStr))),
        getDocs(query(sessRef, where('date', '>=', prevRangeStartStr), where('date', '<', rangeStartStr))),
      ]);

      // ── 3. Build chart skeleton (full set of labels) then overlay real data ──
      const DAYS_ABR  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
      const MNTHS_ABR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

      // Base skeleton ensures the chart always has data to render
      let skeleton = []
      if (period === 'Semana') {
        skeleton = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(now)
          d.setDate(now.getDate() - (6 - i))
          return { name: DAYS_ABR[d.getDay()], presencas: 0, faltas: 0, justificados: 0 }
        })
      } else if (period === 'Mês') {
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
        skeleton = Array.from({ length: daysInMonth }, (_, i) => ({
          name: String(i + 1).padStart(2, '0'),
          presencas: 0, faltas: 0, justificados: 0
        }))
      } else {
        skeleton = MNTHS_ABR.map(name => ({ name, presencas: 0, faltas: 0, justificados: 0 }))
      }

      // Overlay real session data into the skeleton
      for (const s of currentSnap.docs) {
        const dateStr = s.data().date
        let label = ''
        if (period === 'Semana') {
          const d = new Date(`${dateStr}T12:00:00Z`)
          label = DAYS_ABR[d.getDay()]
        } else if (period === 'Mês') {
          label = dateStr.split('-')[2] // "01"-"31"
        } else {
          const d = new Date(`${dateStr}T12:00:00Z`)
          label = MNTHS_ABR[d.getMonth()]
        }

        const attSnap = await getDocs(collection(s.ref, 'attendances'))
        let p = 0, f = 0, j = 0
        attSnap.forEach(a => {
          const st = a.data().status
          if (st === 'present') p++
          else if (st === 'absent') f++
          else if (st === 'justified') j++
        })

        // Find and update matching skeleton entry
        const entry = skeleton.find(e => e.name === label)
        if (entry) { entry.presencas += p; entry.faltas += f; entry.justificados += j }
      }

      const chartData = skeleton

      // weekGrowth: compare current vs prev period total presences
      const currentTotal = skeleton.reduce((sum, e) => sum + e.presencas, 0)
      let prevTotal = 0
      for (const s of prevSnap.docs) {
        const attSnap = await getDocs(collection(s.ref, 'attendances'))
        attSnap.forEach(a => { if (a.data().status === 'present') prevTotal++ })
      }
      const weekGrowth = prevTotal > 0 ? Math.round(((currentTotal - prevTotal) / prevTotal) * 100) : 0

      // ── 4. Sessions list for "Histórico" card ────────────
      const recentSessions = currentSnap.docs
        .map(s => ({ id: s.id, ref: s.ref, ...s.data() }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 10);

      // Attach attendance counts to sessions
      const sessionsWithCounts = await Promise.all(
        recentSessions.map(async (s) => {
          const attSnap = await getDocs(collection(db, 'sessions', s.id, 'attendances'));
          let presencas = 0, total = 0;
          attSnap.forEach(a => {
            total++;
            if (a.data().status === 'present') presencas++;
          });
          return { ...s, presencasCount: presencas, totalCount: total, attendances: attSnap.docs.map(d => ({ id: d.id, ...d.data() })) };
        })
      );

      // ── 5. Absent students > 10 days ─────────────────────
      const isActive = (st) => !['inativo', 'inactive', 'suspenso', 'suspended', 'arquivado', 'archived'].includes(st);
      const activeStudents = students.filter(s => isActive(s.status));

      // Fetch last attendance per student via collectionGroup
      const lastAttMap = {};
      try {
        // Build map from students' lastAttendanceAt field (fast path)
        activeStudents.forEach(s => {
          const d = parseDate(s.lastAttendanceAt || s.createdAt);
          if (d) lastAttMap[s.id] = d;
        });
      } catch {}

      const absentStudents = activeStudents
        .filter(s => {
          const last = lastAttMap[s.id];
          const days = last ? daysBetween(last, now) : null;
          return days === null || days > 10;
        })
        .map(s => {
          const last = lastAttMap[s.id];
          const days = last ? daysBetween(last, now) : null;
          return {
            id: s.id,
            name: s.name,
            phone: s.phone || s.whatsapp || '',
            belt: s.belt || 'white',
            modality: s.modality || '',
            daysAbsent: days,
            lastSeen: last,
            isCritical: days === null || days > 30,
          };
        })
        .sort((a, b) => (b.daysAbsent || 999) - (a.daysAbsent || 999));

      // ── 6. Retention rate ────────────────────────────────
      // % of active students with ≥2 check-ins in the last 7 days
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      const recentActivityMap = {};
      currentSnap.docs.forEach(s => {
        const sd = new Date(`${s.data().date}T12:00:00Z`);
        if (sd >= sevenDaysAgo) {
          // will count below
        }
      });
      // Simplified: retention = % active without 30d absence
      const retentionRate = activeStudents.length > 0
        ? Math.round(((activeStudents.length - absentStudents.filter(s => s.isCritical).length) / activeStudents.length) * 100)
        : 100;

      // ── 7. Alerts ────────────────────────────────────────
      let warning = 0, critical = 0;
      absentStudents.forEach(s => {
        if (s.isCritical) critical++;
        else warning++;
      });

      // ── 8. Inactive students (NEW) ───────────────────────
      const inactiveStudents = students
        .filter(s => ['inativo', 'inactive'].includes(s.status))
        .map(s => ({
          id: s.id,
          name: s.name,
          phone: s.phone || s.whatsapp || '',
          belt: s.belt || 'white',
          modality: s.modality || '',
          reason: s.statusReason || 'Não informado',
          inactiveSince: parseDate(s.lastStatusAt),
        }))
        .sort((a,b) => (b.inactiveSince || 0) - (a.inactiveSince || 0));

      // ── 9. Team Stats (NEW) ────────────────────────────────
      const teamSnap = await getDocs(query(collectionGroup(db, 'membros')))
      let teamTotal = 0, teamActive = 0, teamByRole = {}
      teamSnap.forEach(doc => {
        const d = doc.data()
        teamTotal++
        if (d.status !== 'Inativo' && d.status !== 'inativo') teamActive++
        const r = d.role || 'membro'
        teamByRole[r] = (teamByRole[r] || 0) + 1
      })

      setData({
        todayPresences,
        chartData,
        sessions: sessionsWithCounts,
        absentStudents,
        inactiveStudents,
        retentionRate,
        weekGrowth,
        activeStudentsAlerts: { warning, critical },
        teamStats: { total: teamTotal, active: teamActive, byRole: teamByRole },
      });
    } catch (err) {
      console.error('DashboardStats error:', err);
    } finally {
      setLoading(false);
    }
  }, [isLoadingStudents, students, period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, refresh: fetchData };
}
