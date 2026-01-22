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
        
        // Update active section immediately when clicked
        setActiveSection(sectionId);
      }
    };
  };

  useEffect(() => {
    // Scroll-spy: Use Intersection Observer to detect which section is in viewport
    const sections = document.querySelectorAll('#home, #about-section');
    const navbar = document.querySelector('.navbar');
    const navbarHeight = navbar ? navbar.offsetHeight : 80;

    // Function to determine which section should be active based on scroll position
    const updateActiveSection = () => {
      const scrollPosition = window.scrollY + navbarHeight + 150; // Offset for better detection
      
      sections.forEach((section) => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        const sectionBottom = sectionTop + sectionHeight;
        
        // Check if scroll position is within this section
        if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
          setActiveSection(section.id);
        }
      });

      // Handle case when at the very top
      if (window.scrollY < 100) {
        setActiveSection('home');
      }

      // Handle case when at the bottom (last section should be active)
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 50) {
        const lastSection = sections[sections.length - 1];
        if (lastSection && lastSection.id) {
          setActiveSection(lastSection.id);
        }
      }
    };

    // Use Intersection Observer as primary method
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

    // Also listen to scroll events for more responsive updates
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    updateActiveSection(); // Check on mount

    // Cleanup
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
              href="#about-section" 
              className={`nav-link ${activeSection === 'about-section' ? 'active' : ''}`}
              onClick={scrollToSection('about-section')}
            >
              About
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;
