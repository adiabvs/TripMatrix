import Link from 'next/link';
import { MdArrowBack, MdSettings } from 'react-icons/md';
import UserMenu from '@/components/UserMenu';

interface TripHeaderProps {
  title: string;
  canEdit: boolean;
  tripId: string;
  backHref?: string;
}

export default function TripHeader({ title, canEdit, tripId, backHref = '/trips' }: TripHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-black border-b border-gray-800">
      <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center justify-between">
        <Link href={backHref} className="text-white">
          <MdArrowBack className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Link
              href={`/trips/${tripId}/settings`}
              className="text-white"
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

