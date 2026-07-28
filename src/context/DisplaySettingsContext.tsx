import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface DisplaySettingsConfig {
  primaryAccent: string;
  logoText: string;
  brandName: string;
  brandSlogan: string;
  dashboardTitle: string;
  motivationQuote: string;
  fontFamily: string;
}

const DEFAULT_DISPLAY_SETTINGS: DisplaySettingsConfig = {
  primaryAccent: 'emerald',
  logoText: 'HL',
  brandName: 'Hoàng Long',
  brandSlogan: 'Lâm Đồng ERP',
  dashboardTitle: 'Hệ Thống Chỉ Số Doanh Nghiệp',
  motivationQuote: '"May mắn đứng về phía người dám đương đầu."',
  fontFamily: 'Inter',
};

interface DisplaySettingsContextType {
  displaySettings: DisplaySettingsConfig;
  setDisplaySettings: React.Dispatch<React.SetStateAction<DisplaySettingsConfig>>;
}

const DisplaySettingsContext = createContext<DisplaySettingsContextType | undefined>(undefined);

export const DisplaySettingsProvider = ({ children }: { children: ReactNode }) => {
  const [displaySettings, setDisplaySettings] = useState<DisplaySettingsConfig>(() => {
    const saved = localStorage.getItem('hl_display_settings');
    return saved ? JSON.parse(saved) : DEFAULT_DISPLAY_SETTINGS;
  });

  // Chỉ dùng localStorage — không gọi Supabase
  useEffect(() => {
    localStorage.setItem('hl_display_settings', JSON.stringify(displaySettings));
  }, [displaySettings]);

  return (
    <DisplaySettingsContext.Provider value={{ displaySettings, setDisplaySettings }}>
      {children}
    </DisplaySettingsContext.Provider>
  );
};

export const useDisplaySettings = () => {
  const context = useContext(DisplaySettingsContext);
  if (!context) {
    throw new Error('useDisplaySettings must be used within a DisplaySettingsProvider');
  }
  return context;
};
