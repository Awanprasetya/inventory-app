import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { getTourForRoute, MODULE_TOURS } from '../config/tourConfig.js';
import { toastSuccess } from '../utils/alert.js';

const TourContext = createContext(null);
const STORAGE_PREFIX = 'syntesia_tour_completed_';

export function TourProvider({ children }) {
  const location = useLocation();
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [activeModuleName, setActiveModuleName] = useState('SyntesiaERP');
  const [steps, setSteps] = useState([]);

  // Dapatkan konfigurasi tur untuk halaman yang sedang aktif
  const currentRouteTour = useMemo(() => {
    return getTourForRoute(location.pathname) || MODULE_TOURS['/'];
  }, [location.pathname]);

  // Mulai tur (bisa untuk modul saat ini atau modul tertentu)
  const startTour = useCallback((target = null) => {
    let targetSteps = [];
    let name = 'SyntesiaERP';

    if (Array.isArray(target) && target.length > 0) {
      targetSteps = target;
      name = 'Panduan Fitur';
    } else if (typeof target === 'string') {
      const cfg = getTourForRoute(target) || MODULE_TOURS['/'];
      targetSteps = cfg.steps;
      name = cfg.moduleName;
    } else {
      // Default: gunakan route aktif saat ini
      const cfg = getTourForRoute(location.pathname) || MODULE_TOURS['/'];
      targetSteps = cfg.steps;
      name = cfg.moduleName;
    }

    setSteps(targetSteps);
    setActiveModuleName(name);
    setCurrentStepIndex(0);
    setIsTourOpen(true);
  }, [location.pathname]);

  // Mulai tur dashboard umum dari mana saja
  const startGeneralTour = useCallback(() => {
    const cfg = MODULE_TOURS['/'];
    setSteps(cfg.steps);
    setActiveModuleName(cfg.moduleName);
    setCurrentStepIndex(0);
    setIsTourOpen(true);
  }, []);

  // Lanjut ke langkah berikutnya
  const nextStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      if (prev < steps.length - 1) {
        return prev + 1;
      }
      finishTour();
      return prev;
    });
  }, [steps.length]);

  // Kembali ke langkah sebelumnya
  const prevStep = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  // Lewati / Skip panduan
  const skipTour = useCallback(() => {
    setIsTourOpen(false);
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${location.pathname}`, 'true');
      localStorage.setItem('syntesia_tour_completed', 'true');
    } catch (_) {}
  }, [location.pathname]);

  // Selesaikan panduan
  const finishTour = useCallback(() => {
    setIsTourOpen(false);
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${location.pathname}`, 'true');
      localStorage.setItem('syntesia_tour_completed', 'true');
    } catch (_) {}
    toastSuccess(`Bagus! Anda telah menyelesaikan panduan ${activeModuleName}.`);
  }, [location.pathname, activeModuleName]);

  // Cek apakah tur modul ini sudah pernah diselesaikan
  const isCompleted = (path = null) => {
    try {
      const targetPath = path || location.pathname;
      return (
        localStorage.getItem(`${STORAGE_PREFIX}${targetPath}`) === 'true' ||
        localStorage.getItem('syntesia_tour_completed') === 'true'
      );
    } catch (_) {
      return false;
    }
  };

  const currentStep = steps[currentStepIndex] || null;

  return (
    <TourContext.Provider
      value={{
        isTourOpen,
        currentStepIndex,
        currentStep,
        totalSteps: steps.length,
        steps,
        activeModuleName,
        currentRouteTour,
        startTour,
        startGeneralTour,
        nextStep,
        prevStep,
        skipTour,
        finishTour,
        isCompleted,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour harus digunakan di dalam <TourProvider>');
  }
  return context;
}
