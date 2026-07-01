'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('inbox_token');
    if (token) {
      router.replace('/inbox');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-wa-dark-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-wa-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}
