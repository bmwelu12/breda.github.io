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
        setInterval(() => setShowCursor(prev => !prev), 530);
      }
    }, typingSpeed);

    return () => clearInterval(typingInterval);
  }, []);

  return (
    <>
      {/* Section 1: Home (Brief) - 100vh Hero */}
      <section id="home" className="home-section">
        <div className="home-hero">
          <h1 className="home-title">
            Hi, I'm <span className="highlight">Breda Mwelu</span>
          </h1>
          <p className="home-subtitle">
            {typedText}
            <span className={`typing-cursor ${showCursor ? 'visible' : ''}`}>|</span>
          </p>
          <p className="home-description">
            Building intelligent solutions that solve real-world problems through technology and innovation.
          </p>
        </div>
        <div className="scroll-indicator">
          <div className="mouse"></div>
        </div>
      </section>

      {/* Section 2: About - Two Column Layout */}
      <section id="about" className="about-section">
        <div className="about-container">
          <div className="about-content">
            <h2 className="section-title">About Me</h2>
            <p className="about-text">
              I'm a Technical Product Manager and Full-Stack Developer with a passion for building 
              innovative solutions. Currently serving as Technical Product Manager at SurtAI, I lead 
              cross-functional teams to deliver IDV and Geolocation features.
            </p>
            <p className="about-text">
              My background combines strong technical skills in machine learning and web development 
              with product management expertise. I hold a Bachelor of Science in Computer Science and 
              French (Double Major) from Drew University, with a GPA of 3.63 and honors including Dean's List and Pi Delta Phi.
            </p>
            <p className="about-text">
              I'm passionate about creating products that make a difference, whether through machine learning 
              innovations, elegant web applications, or strategic product decisions.
            </p>
          </div>
          <div className="about-image">
            {/* Placeholder for headshot */}
            <div className="headshot-placeholder">
              <svg
                width="400"
                height="400"
                viewBox="0 0 400 400"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="200" cy="200" r="200" fill="rgba(91, 127, 168, 0.1)" />
                <circle cx="200" cy="160" r="60" fill="rgba(122, 155, 196, 0.2)" />
                <path
                  d="M80 320 Q200 280 320 320"
                  stroke="rgba(122, 155, 196, 0.2)"
                  strokeWidth="6"
                  fill="none"
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Experiences & Media - Bento Box Grid */}
      <section id="experiences" className="experiences-section">
        <div className="experiences-container">
          <h2 className="section-title">Experiences & Media</h2>
          <div className="experiences-grid">
            {/* Dean's List Card */}
            <div className="experience-card academic-card">
              <div className="card-image">
                {/* Insert AI-generated image here to match experience */}
                <img 
                  src="https://via.placeholder.com/600x400/5b7fa8/ffffff?text=Dean's+List" 
                  alt="Dean's List Achievement"
                  className="experience-img"
                />
              </div>
              <div className="card-content">
                <h3 className="card-title">Dean's List</h3>
                <p className="card-description">
                  Recognized for academic excellence at Drew University. Maintained high academic 
                  performance while pursuing a double major in Computer Science and French.
                </p>
                <div className="card-links">
                  <a 
                    href="https://drew.edu/academic/deans-office-college-of-liberal-arts/cla-deans-list/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="card-link"
                  >
                    Dean's List Info
                  </a>
                  <a 
                    href="https://drew.edu/2024/07/01/drew-university-spring-2024-deans-list/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="card-link"
                  >
                    Spring 2024
                  </a>
                  <a 
                    href="https://drew.edu/2023/01/24/drew-university-fall-2022-deans-list/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="card-link"
                  >
                    Fall 2022
                  </a>
                </div>
              </div>
            </div>

            {/* Research Card */}
            <div className="experience-card research-card">
              <div className="card-image">
                {/* Insert AI-generated image here to match experience */}
                <img 
                  src="https://via.placeholder.com/600x400/7a9bc4/ffffff?text=Research" 
                  alt="Research & Innovation"
                  className="experience-img"
                />
              </div>
              <div className="card-content">
                <h3 className="card-title">Research & Innovation</h3>
                <p className="card-description">
                  Exploring cutting-edge technologies in machine learning and AI. Participated in the 
                  Drew Summer Science Institute, gaining hands-on research experience and skills.
                </p>
                <div className="card-links">
                  <a 
                    href="https://drew.edu/2023/08/15/drew-university-students-gain-skills-experience-in-the-drew-summer-science-institute/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="card-link"
                  >
                    Summer Science Institute
                  </a>
                  <a 
                    href="https://maparole.org/author/fren334/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="card-link"
                  >
                    Maparole Publications
                  </a>
                </div>
              </div>
            </div>

            {/* Work/Other Card */}
            <div className="experience-card work-card">
              <div className="card-image">
                {/* Insert AI-generated image here to match experience */}
                <img 
                  src="https://via.placeholder.com/600x400/9db5d1/ffffff?text=Professional+Work" 
                  alt="Professional Experience"
                  className="experience-img"
                />
              </div>
              <div className="card-content">
                <h3 className="card-title">Community Leadership & Recognition</h3>
                <p className="card-description">
                  Recognized for outstanding contributions to the Drew community. Recipient of the 
                  Tilghman International Graduate Student Award for meaningful commitment to campus 
                  and community engagement.
                </p>
                <div className="card-links">
                  <a 
                    href="https://drew.edu/2024/04/19/drew-university-celebrates-community-leaders/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="card-link"
                  >
                    Community Leaders Award
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Contact - Footer */}
      <section id="contact" className="contact-section">
        <div className="contact-container">
          <h2 className="section-title">Get In Touch</h2>
          <p className="contact-description">
            Let's connect and explore opportunities to work together.
          </p>
          <div className="contact-links">
            <a 
              href="https://www.linkedin.com/in/breda-m-87276b1a3/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="social-link linkedin"
              aria-label="LinkedIn"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              LinkedIn
            </a>
            <a 
              href="https://github.com/bmwelu12" 
              target="_blank" 
              rel="noopener noreferrer"
              className="social-link github"
              aria-label="GitHub"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </a>
            <a 
              href="mailto:your.email@example.com" 
              className="social-link email"
              aria-label="Email"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
              Email
            </a>
          </div>
          <p className="contact-footer">
            © {new Date().getFullYear()} Breda Mwelu. All rights reserved.
          </p>
        </div>
      </section>
    </>
  );
}

export default Home;
