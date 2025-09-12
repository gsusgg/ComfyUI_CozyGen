import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MainPage from './pages/MainPage';
import Gallery from './pages/Gallery';

function App() {
    return (
        <HashRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<MainPage />} />
                    <Route path="gallery" element={<Gallery />} />
                </Route>
            </Routes>
        </HashRouter>
    );
}

export default App;