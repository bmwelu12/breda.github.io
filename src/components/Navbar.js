import React from 'react';
import '../App.css';

function Navbar() {
  const scrollToSection = (sectionId) => {
    return (e) => {
      e.preventDefault();
      const section = document.getElementById(sectionId);
      const navbar = document.querySelector('.navbar');
      
      if (section && navbar) {
        const navbarHeight = navbar.offsetHeight;
        const elementPosition = section.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - navbarHeight;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    };
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <a href="#home" className="nav-logo" onClick={scrollToSection('home')}>
          Breda Mwelu
        </a>
        <ul className="nav-menu">
          <li className="nav-item">
            <a href="#home" className="nav-link" onClick={scrollToSection('home')}>
              Home
            </a>
          </li>
          <li className="nav-item">
            <a href="#about-section" className="nav-link" onClick={scrollToSection('about-section')}>
              About
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;
