import { useEffect, useRef } from 'react';
import { updateSosRequest, type SosRequestDoc, type SosAssignmentDoc } from '../../data/sos';
import { logTimelineEvent } from '../../data/timeline';

interface EscalationMonitorProps {
  sosId: string | null;
  liveSosDoc: SosRequestDoc | null;
  assignments: SosAssignmentDoc[];
  heartRate: number;
  spo2: number;
  noMovementDuration: number;
}

export function useSosEscalationMonitor({
  sosId,
  liveSosDoc,
  assignments,
  heartRate,
  spo2,
  noMovementDuration,
}: EscalationMonitorProps) {
  // Use refs to track which events have been fired to prevent duplicate logs
  const firedEvents = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!sosId || !liveSosDoc || liveSosDoc.status !== 'active') {
      firedEvents.current.clear();
      return;
    }

    const intervalId = setInterval(() => {
      const now = Date.now();
      const createdAt = liveSosDoc.createdAt?.seconds 
        ? liveSosDoc.createdAt.seconds * 1000 
        : (liveSosDoc as any)._createdMs || Date.now();
      
      const elapsedSeconds = (now - createdAt) / 1000;

      // RULE 1: No helper response within 30 seconds
      if (
        elapsedSeconds > 30 &&
        (!liveSosDoc.helpersAccepted || liveSosDoc.helpersAccepted.length === 0) &&
        !firedEvents.current.has('rule1_no_helper')
      ) {
        firedEvents.current.add('rule1_no_helper');
        
        updateSosRequest(sosId, {
          escalated: true,
          priority: 2,
          escalationLevel: 1,
          lastEscalationTime: now,
        }).catch(console.error);

        logTimelineEvent(sosId, 'ESCALATION', 'Priority Escalated: No helper responded within 30 seconds. Notifying additional helpers.');
      }

      // RULE 2: No movement > 60 seconds
      if (noMovementDuration > 60 && !firedEvents.current.has('rule2_no_movement')) {
        firedEvents.current.add('rule2_no_movement');
        
        updateSosRequest(sosId, {
          possibleUnconscious: true,
          severity: liveSosDoc.severity === 'minor' ? 'major' : 'critical',
        }).catch(console.error);

        logTimelineEvent(sosId, 'MEDICAL_ALERT', 'Possible Unconscious Victim Detected: No movement for over 60 seconds. Severity upgraded.');
      }

      // RULE 3: Critical Vitals
      const isHrCritical = heartRate > 0 && (heartRate < 40 || heartRate > 170);
      const isSpo2Critical = spo2 > 0 && spo2 < 88;
      
      if ((isHrCritical || isSpo2Critical) && !firedEvents.current.has('rule3_critical_vitals')) {
        firedEvents.current.add('rule3_critical_vitals');
        
        let msg = 'Critical Vital Signs Detected:';
        if (isHrCritical) msg += ` HR is ${heartRate}.`;
        if (isSpo2Critical) msg += ` SpO2 is ${spo2}%.`;

        updateSosRequest(sosId, {
          severity: 'critical',
          escalated: true,
          lastEscalationTime: now,
        }).catch(console.error);

        logTimelineEvent(sosId, 'CRITICAL_VITALS', msg);
      }

      // RULE 4: Helper not reaching
      // Look for any accepted assignment that has been active for a while but helper is far/stalled
      assignments.forEach((a) => {
        if (a.status === 'accepted' || a.status === 'enroute') {
          const acceptedAt = (a as any)._acceptedMs || (a.acceptedAt as any)?.seconds * 1000 || now;
          const assignedElapsed = (now - acceptedAt) / 1000;
          
          if (assignedElapsed > 300 && a.distanceMeters && a.distanceMeters > 500) {
            const eventKey = `rule4_stalled_helper_${a.id}`;
            if (!firedEvents.current.has(eventKey)) {
              firedEvents.current.add(eventKey);
              logTimelineEvent(sosId, 'BACKUP_REQUIRED', `Backup Helper Activated: Responder ${a.helperName || a.helperId} is taking longer than expected to reach.`);
            }
          }
        }
      });

    }, 10000); // Run every 10 seconds

    return () => clearInterval(intervalId);
  }, [sosId, liveSosDoc, assignments, heartRate, spo2, noMovementDuration]);
}
