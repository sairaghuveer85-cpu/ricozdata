import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider } from './context/AppContext';
import { TourProvider } from './context/TourContext';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppProvider>
          <TourProvider>
            <AppRoutes />
          </TourProvider>
        </AppProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
