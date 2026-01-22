import React, { useState, useEffect } from 'react';
import './Home.css';

function Home() {
  const [typedText, setTypedText] = useState('');
  const [showCursor, setShowCursor] = useState(true);

  const fullText = 'Technical Product Manager & Full-Stack Developer';
  const typingSpeed = 50;

  useEffect(() => {
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex < fullText.length) {
        setTypedText(fullText.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        // Blink cursor
        setInterval(() => setShowCursor(prev => !prev), 530);
      }
    }, typingSpeed);

    return () => clearInterval(typingInterval);
  }, []);

  const scrollToAbout = (e) => {
    e.preventDefault();
    const aboutSection = document.getElementById('about-section');
    const navbar = document.querySelector('.navbar');
    if (aboutSection && navbar) {
      const navbarHeight = navbar.offsetHeight;
      const elementPosition = aboutSection.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navbarHeight;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div id="home" className="home">
      <div className="home-container">
        <div className="home-content">
          <h1 className="home-title">
            Hi, I'm <span className="highlight">Breda Mwelu</span>
          </h1>
          <p className="home-subtitle">
            {typedText}
            <span className={`typing-cursor ${showCursor ? 'visible' : ''}`}>|</span>
          </p>
          <p className="home-description">
            Welcome to my portfolio! I'm a Computer Science graduate from Drew University with expertise in 
            machine learning, product management, and full-stack development. Passionate about building 
            intelligent solutions that solve real-world problems.
          </p>
          <div className="home-buttons">
            <a href="#projects" className="btn btn-primary">
              View My Work
            </a>
            <button type="button" className="btn btn-secondary" onClick={scrollToAbout}>
              Learn More About Me
            </button>
          </div>
        </div>
        <div className="home-image">
          <div className="avatar-placeholder">
            <svg
              width="300"
              height="300"
              viewBox="0 0 300 300"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="150" cy="150" r="150" fill="rgba(255, 255, 255, 0.2)" />
              <circle cx="150" cy="120" r="50" fill="rgba(255, 255, 255, 0.3)" />
              <path
                d="M50 250 Q150 200 250 250"
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="4"
                fill="none"
              />
            </svg>
          </div>
        </div>
      </div>
      <div className="scroll-indicator">
        <div className="mouse"></div>
      </div>
    </div>
  );
}

export default Home;
