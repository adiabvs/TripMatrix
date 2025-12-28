import { useCountdown } from '@/hooks/useCountdown';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';

interface CountdownTimerProps {
  startTime: Date | string;
  className?: string;
}

export default function CountdownTimer({ startTime, className = '' }: CountdownTimerProps) {
  const timeLeft = useCountdown(startTime);


  // If timeLeft is null, calculate it directly as a fallback
  // This handles the case where the hook hasn't initialized yet
  let calculatedTimeLeft: { days: number; hours: number; minutes: number; seconds: number } | null = null;
  
  if (!timeLeft && startTime) {
    try {
      const parsedDate = toDate(startTime);
      const targetTime = parsedDate.getTime();
      const now = Date.now();
      
      // If date is valid and in future, calculate time remaining
      if (!isNaN(targetTime) && targetTime > now) {
        const diff = targetTime - now;
        const totalSeconds = Math.floor(diff / 1000);
        const totalMinutes = Math.floor(totalSeconds / 60);
        const totalHours = Math.floor(totalMinutes / 60);
        const totalDays = Math.floor(totalHours / 24);

        calculatedTimeLeft = {
          days: totalDays,
          hours: totalHours % 24,
          minutes: totalMinutes % 60,
          seconds: totalSeconds % 60
        };
      }
    } catch (error) {
      console.error('CountdownTimer: Error parsing startTime:', error, startTime);
    }
  }
  
  // Use calculated time if hook hasn't provided it yet
  const displayTimeLeft = timeLeft || calculatedTimeLeft;

  if (!displayTimeLeft) {
    // If timeLeft is null and date is invalid or in past, return null
    return null;
  }

  const formatTimeLeft = () => {
    // Guard against NaN values
    const days = isNaN(displayTimeLeft.days) ? 0 : Math.max(0, displayTimeLeft.days);
    const hours = isNaN(displayTimeLeft.hours) ? 0 : Math.max(0, displayTimeLeft.hours);
    const minutes = isNaN(displayTimeLeft.minutes) ? 0 : Math.max(0, displayTimeLeft.minutes);
    const seconds = isNaN(displayTimeLeft.seconds) ? 0 : Math.max(0, displayTimeLeft.seconds);
    
    // If everything is 0, don't show countdown
    if (days === 0 && hours === 0 && minutes === 0 && seconds === 0) {
      return null;
    }
    
    const parts: string[] = [];
    
    // If days > 0, always show days hours minutes
    if (days > 0) {
      parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
      parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
      parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
    } else if (hours > 0) {
      // If hours > 0 but days = 0, show hours minutes
      parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
      if (minutes > 0) {
        parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
      }
    } else if (minutes > 0) {
      // If only minutes > 0, show just minutes
      parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
    } else if (seconds > 0) {
      // If only seconds > 0, show seconds
      parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
    }
    
    return parts.join(' ');
  };

  const formattedTime = formatTimeLeft();
  
  // Don't render if time is 0 or invalid
  if (!formattedTime) {
    return null;
  }

  return (
    <div className={`p-4 bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg border border-blue-700/50 ${className}`}>
      <p className="text-white font-semibold text-sm mb-1 text-center">
        Trip starting in {formattedTime}
      </p>
      <p className="text-gray-300 text-xs text-center">
        {format(toDate(startTime), 'MMM dd, yyyy • h:mm a')}
      </p>
    </div>
  );
}

