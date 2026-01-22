import React from 'react';
import Navbar from './components/Navbar';
import ScrollProgress from './components/ScrollProgress';
import DataBackground from './components/DataBackground';
import Home from './pages/Home';
import './App.css';

function App() {
  return (
    <div className="App">
      <DataBackground />
      <ScrollProgress />
      <Navbar />
      <Home />
    </div>
  );
}

export default App;
