import { useState, useEffect } from 'react';
import { toDate } from '@/lib/dateUtils';

export interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function useCountdown(targetDate: Date | string | null): CountdownTime | null {
  const [timeLeft, setTimeLeft] = useState<CountdownTime | null>(null);

  useEffect(() => {
    if (!targetDate) {
      setTimeLeft(null);
      return;
    }

    // Use toDate utility to properly parse Firestore timestamps and other date formats
    const targetDateObj = toDate(targetDate);
    const target = targetDateObj.getTime();
    
    // Check if date is valid
    if (isNaN(target)) {
      setTimeLeft(null);
      return;
    }

    const now = Date.now();

    // If target is in the past, return null
    if (target <= now) {
      setTimeLeft(null);
      return;
    }

    const updateCountdown = () => {
      const currentTime = Date.now();
      const diff = target - currentTime;

      // If time has passed, return null
      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }

      // Calculate time components correctly
      const totalSeconds = Math.floor(diff / 1000);
      const totalMinutes = Math.floor(totalSeconds / 60);
      const totalHours = Math.floor(totalMinutes / 60);
      const totalDays = Math.floor(totalHours / 24);

      const days = totalDays;
      const hours = totalHours % 24;
      const minutes = totalMinutes % 60;
      const seconds = totalSeconds % 60;

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}







