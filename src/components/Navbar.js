import React, { useState, useEffect } from 'react';
import '../App.css';

function Navbar() {
  const [activeSection, setActiveSection] = useState('home');

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
        
        setActiveSection(sectionId);
      }
    };
  };

  useEffect(() => {
    const sections = document.querySelectorAll('#home, #about, #experiences, #contact');
    const navbar = document.querySelector('.navbar');
    const navbarHeight = navbar ? navbar.offsetHeight : 80;

    const observerOptions = {
      root: null,
      rootMargin: `-${navbarHeight}px 0px -60% 0px`,
      threshold: [0, 0.1, 0.5, 1]
    };

    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.1) {
          const sectionId = entry.target.id;
          if (sectionId) {
            setActiveSection(sectionId);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    sections.forEach((section) => {
      if (section.id) {
        observer.observe(section);
      }
    });

    // Handle top of page
    const handleScroll = () => {
      if (window.scrollY < 100) {
        setActiveSection('home');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      sections.forEach((section) => {
        if (section.id) {
          observer.unobserve(section);
        }
      });
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <nav className="navbar">
      <div className="nav-container">
        <a href="#home" className="nav-logo" onClick={scrollToSection('home')}>
          Breda Mwelu
        </a>
        <ul className="nav-menu">
          <li className="nav-item">
            <a 
              href="#home" 
              className={`nav-link ${activeSection === 'home' ? 'active' : ''}`}
              onClick={scrollToSection('home')}
            >
              Home
            </a>
          </li>
          <li className="nav-item">
            <a 
              href="#about" 
              className={`nav-link ${activeSection === 'about' ? 'active' : ''}`}
              onClick={scrollToSection('about')}
            >
              About
            </a>
          </li>
          <li className="nav-item">
            <a 
              href="#experiences" 
              className={`nav-link ${activeSection === 'experiences' ? 'active' : ''}`}
              onClick={scrollToSection('experiences')}
            >
              Experiences
            </a>
          </li>
          <li className="nav-item">
            <a 
              href="#contact" 
              className={`nav-link ${activeSection === 'contact' ? 'active' : ''}`}
              onClick={scrollToSection('contact')}
            >
              Contact
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;
