import { createContext, useContext, useState, useEffect } from 'react';
import { getSettings } from '../services/api/settingApi';
import { getImageUrl } from '../utils/imageUtils';

const SettingContext = createContext();

export const useSettings = () => useContext(SettingContext);

export const SettingProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => {
    try {
      const cached = localStorage.getItem('glentro_app_settings');
      return cached ? JSON.parse(cached) : {};
    } catch (e) {
      return {};
    }
  });
  const [loading, setLoading] = useState(!settings || Object.keys(settings).length === 0);

  const fetchSettings = async () => {
    try {
      const res = await getSettings();
      if (res.data?.success && res.data.data) {
        setSettings(res.data.data);
        localStorage.setItem('glentro_app_settings', JSON.stringify(res.data.data));
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Update favicon and title dynamically
  useEffect(() => {
    if (settings.appLogo) {
      const favicon = document.getElementById('favicon');
      if (favicon) {
        favicon.href = getImageUrl(settings.appLogo);
      }
    }
    
    if (settings.appName) {
      document.title = settings.appName;
    } else {
      document.title = 'SalonBook';
    }
  }, [settings.appLogo, settings.appName]);

  return (
    <SettingContext.Provider value={{ settings, fetchSettings, loading }}>
      {children}
    </SettingContext.Provider>
  );
};
