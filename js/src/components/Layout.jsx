import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

const Layout = () => {
    return (
        <div className="bg-base-100 text-gray-300 min-h-screen font-sans">
            <header className="bg-base-200/80 backdrop-blur-sm shadow-lg sticky top-0 z-50">
                <nav className="container mx-auto px-4 py-3 flex justify-between items-center">
                    <Link to="/">
                        <h1 className="text-2xl font-bold text-white tracking-wider">CozyGen</h1>
                    </Link>
                    <div className="flex items-center space-x-4">
                        <NavLink 
                            to="/" 
                            className={({ isActive }) => 
                                `px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-accent text-white' : 'text-gray-300 hover:bg-base-300'}`
                            }
                        >
                            Generate
                        </NavLink>
                        <NavLink 
                            to="/gallery" 
                            className={({ isActive }) => 
                                `px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-accent text-white' : 'text-gray-300 hover:bg-base-300'}`
                            }
                        >
                            Gallery
                        </NavLink>
                    </div>
                </nav>
            </header>
            <main className="container mx-auto p-4">
                <Outlet />
            </main>
        </div>
    );
}

export default Layout;