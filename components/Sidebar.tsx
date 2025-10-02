import React from 'react';
import { Page } from '../types';
import { ChartBarIcon, UsersIcon, CogIcon, ClockIcon, XMarkIcon } from './IconComponents';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage, sidebarOpen, setSidebarOpen }) => {
  const navItems = [
    { name: Page.SETUP, icon: <CogIcon className="w-6 h-6" /> },
    { name: Page.RESULTS, icon: <ChartBarIcon className="w-6 h-6" /> },
    { name: Page.HISTORY, icon: <ClockIcon className="w-6 h-6" /> },
  ];

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className={`fixed inset-0 bg-black/70 z-30 lg:hidden transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      ></div>

      <aside
        className={`fixed inset-y-0 left-0 bg-theme-surface text-theme-text-primary flex flex-col w-64 z-40
                    transform transition-transform duration-300 ease-in-out 
                    lg:static lg:translate-x-0 ${
                      sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
      >
        <div className="flex items-center justify-between h-20 border-b border-theme-border px-4">
          <h1 className="text-3xl font-bold text-white">Nakly</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-theme-text-secondary hover:text-white"
            aria-label="Close menu"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-6">
          <ul>
            {navItems.map((item) => (
              <li key={item.name}>
                <button
                  onClick={() => {
                    setCurrentPage(item.name);
                    setSidebarOpen(false); // Close sidebar on navigation
                  }}
                  className={`flex items-center w-full px-4 py-3 my-1 rounded-lg transition-colors duration-200 ${
                    currentPage === item.name
                      ? 'bg-theme-accent text-white'
                      : 'text-theme-text-secondary hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span className="ml-4 font-medium">{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-theme-border text-center text-xs text-gray-500">
          <p>&copy; 2025 Nakly Platform</p>
          <p>Prototype Version</p>
        </div>
      </aside>
    </>
  );
};
