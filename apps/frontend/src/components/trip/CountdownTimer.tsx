import { useCountdown } from '@/hooks/useCountdown';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';

interface CountdownTimerProps {
  startTime: Date | string;
  className?: string;
}

export default function CountdownTimer({ startTime, className = '' }: CountdownTimerProps) {
  const timeLeft = useCountdown(startTime);

  if (!timeLeft) {
    return null;
  }

  const formatTimeLeft = () => {
    const parts: string[] = [];
    if (timeLeft.days > 0) {
      parts.push(`${timeLeft.days} ${timeLeft.days === 1 ? 'day' : 'days'}`);
    }
    if (timeLeft.hours > 0) {
      parts.push(`${timeLeft.hours} ${timeLeft.hours === 1 ? 'hour' : 'hours'}`);
    }
    if (timeLeft.minutes > 0 || parts.length === 0) {
      parts.push(`${timeLeft.minutes} ${timeLeft.minutes === 1 ? 'minute' : 'minutes'}`);
    }
    return parts.join(', ');
  };

  return (
    <div className={`p-4 bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg border border-blue-700/50 ${className}`}>
      <p className="text-white font-semibold text-sm mb-1 text-center">
        Trip starting in {formatTimeLeft()}
      </p>
      <p className="text-gray-300 text-xs text-center">
        {format(toDate(startTime), 'MMM dd, yyyy • h:mm a')}
      </p>
    </div>
  );
}

