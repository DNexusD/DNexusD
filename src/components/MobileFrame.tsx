import React from 'react';
import { useApp } from '../context/AppContext';
import { Wifi, BatteryMedium, Signal } from 'lucide-react';

interface MobileFrameProps {
  children: React.ReactNode;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({ children }) => {
  return (
    <main className="w-full flex-1">
      {children}
    </main>
  );
};
