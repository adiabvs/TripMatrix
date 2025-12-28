'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MdArrowBack, MdSettings } from 'react-icons/md';
import UserMenu from '@/components/UserMenu';

interface TripHeaderProps {
  title: string;
  canEdit: boolean;
  tripId: string;
  backHref?: string;
}

export default function TripHeader({ title, canEdit, tripId, backHref }: TripHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    // Use browser back navigation to return to the previous page
    // If there's no history, it will stay on the current page
    router.back();
  };

  return (
    <header className="sticky top-0 z-50 bg-black border-b border-gray-800">
      <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center justify-between">
        <button onClick={handleBack} className="text-white hover:opacity-70 active:scale-95 transition-all p-1 rounded-full">
          <MdArrowBack className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Link
              href={`/trips/${tripId}/settings`}
              className="text-white hover:opacity-70 active:scale-95 transition-all p-1 rounded-full"
              title="Trip Settings"
            >
              <MdSettings className="w-6 h-6" />
            </Link>
          )}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

