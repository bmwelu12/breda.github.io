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
      const sections = document.querySelectorAll('#home, #about, #experience, #media, #contact');
    const navbar = document.querySelector('.navbar');
    const navbarHeight = navbar ? navbar.offsetHeight : 80;

    const updateActiveSection = () => {
      const scrollPosition = window.scrollY + navbarHeight + 100;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // Check if we're at the bottom of the page (within 100px)
      if (window.scrollY + windowHeight >= documentHeight - 100) {
        setActiveSection('contact');
        return;
      }

      // Check each section
      let currentSection = 'home';
      sections.forEach((section) => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        const sectionBottom = sectionTop + sectionHeight;

        // For experience section, keep it active if we're in it
        if (section.id === 'experience') {
          if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
            currentSection = 'experience';
          }
        } else if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
          currentSection = section.id;
        }
      });

      setActiveSection(currentSection);
    };

    // Use Intersection Observer for more accurate detection
    const observerOptions = {
      root: null,
      rootMargin: `-${navbarHeight + 50}px 0px -50% 0px`,
      threshold: [0, 0.1, 0.3, 0.5, 0.7, 1]
    };

    const observerCallback = (entries) => {
      // Find the section with the highest intersection ratio
      let maxRatio = 0;
      let activeId = 'home';

      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          activeId = entry.target.id;
        }
      });

      // Only update if we found a section with significant intersection
      if (maxRatio > 0.1) {
        setActiveSection(activeId);
      }
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    sections.forEach((section) => {
      if (section.id) {
        observer.observe(section);
      }
    });

    // Also use scroll listener for bottom-of-page detection
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    updateActiveSection(); // Initial check

    return () => {
      sections.forEach((section) => {
        if (section.id) {
          observer.unobserve(section);
        }
      });
      window.removeEventListener('scroll', updateActiveSection);
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
              href="#experience" 
              className={`nav-link ${activeSection === 'experience' ? 'active' : ''}`}
              onClick={scrollToSection('experience')}
            >
              Experiences
            </a>
          </li>
          <li className="nav-item">
            <a 
              href="#media" 
              className={`nav-link ${activeSection === 'media' ? 'active' : ''}`}
              onClick={scrollToSection('media')}
            >
              Media
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
