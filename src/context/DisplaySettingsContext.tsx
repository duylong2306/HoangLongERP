import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { companyScopedKey } from '../lib/supabase';

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
  primaryAccent: 'blue',
  logoText: 'Lo',
  brandName: 'LoLo',
  brandSlogan: 'Công nghệ tạo giá trị – Quản trị nâng tầm',
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
  // Multi-tenant: key localStorage PHẢI gắn company_id (companyScopedKey) —
  // trước đây dùng thẳng 'hl_display_settings' (không gắn), nên brandName/
  // brandSlogan (tên thương hiệu tuỳ biến, xem DisplaySettingsPage.tsx) của
  // công ty A lưu 1 lần trên trình duyệt là HIỆN VĨNH VIỄN cho MỌI công ty
  // khác đăng nhập sau đó trên cùng trình duyệt (context này chỉ đọc
  // localStorage, không tự gọi Supabase để so khớp lại theo công ty đang
  // đăng nhập). Phát hiện qua test thực tế 2026-09-30: công ty test mới tạo,
  // chưa từng cấu hình gì, vẫn hiện brandName/brandSlogan cũ của Hoàng Long.
  const [displaySettings, setDisplaySettings] = useState<DisplaySettingsConfig>(() => {
    const saved = localStorage.getItem(companyScopedKey('hl_display_settings'));
    return saved ? JSON.parse(saved) : DEFAULT_DISPLAY_SETTINGS;
  });

  // Chỉ dùng localStorage — không gọi Supabase
  useEffect(() => {
    localStorage.setItem(companyScopedKey('hl_display_settings'), JSON.stringify(displaySettings));
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
