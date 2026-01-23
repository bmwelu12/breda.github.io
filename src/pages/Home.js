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

      {/* Section 3: Experiences - Clean Minimal List */}
      <section id="experiences" className="experiences-section">
        <div className="experiences-container">
          <h2 className="section-title">Experiences</h2>
          <div className="experiences-list">
            {/* SurtAI */}
            <div className="experience-item">
              <div className="experience-header">
                <h3 className="experience-title">Technical Product Manager</h3>
                <span className="experience-company">SurtAI</span>
                <span className="experience-location">Boston, MA</span>
                <span className="experience-period">Oct 2025 - Present</span>
              </div>
              <ul className="experience-bullets">
                <li>Serve as sole technical product and project manager building IDV and Geolocation features launching for <strong>4 clients in 3 months</strong></li>
                <li>Manage offshore and near shore engineering team, owning roadmap, backlog, and cross-timezone delivery</li>
                <li>Design and integrate verification flows, balancing compliance, fraud risk and user experience</li>
                <li>Lead 0 to 1 build and successful client launches, translating regulatory requirements into technical specifications and execution plans</li>
              </ul>
            </div>

            {/* Beats By Dre */}
            <div className="experience-item">
              <div className="experience-header">
                <h3 className="experience-title">Consumer Data Analyst Intern</h3>
                <span className="experience-company">Beats By Dre</span>
                <span className="experience-location">New York, NY</span>
                <span className="experience-period">Jun 2024 - Aug 2024</span>
              </div>
              <ul className="experience-bullets">
                <li>Achieved a <strong>10% increase</strong> in targeted marketing effectiveness by informing strategic brand and marketing decisions</li>
                <li>Collected and analyzed data from over <strong>500 surveys</strong>, integrating both quantitative and qualitative findings</li>
                <li>Delivered actionable insights through three detailed reports and two visual summaries based on in-depth research</li>
              </ul>
            </div>

            {/* Drew Summer Science Institute */}
            <div className="experience-item">
              <div className="experience-header">
                <h3 className="experience-title">Machine Learning Researcher</h3>
                <span className="experience-company">Drew Summer Science Institute</span>
                <span className="experience-location">Madison, NJ</span>
                <span className="experience-period">Jun 2023 - Aug 2023</span>
              </div>
              <ul className="experience-bullets">
                <li>Analyzed <strong>15,000 Vogue Runway photos</strong> and <strong>1,000 social media images</strong> using object detection and image classification</li>
                <li>Applied LSTM models for time series analysis, predicting fashion trends from historical data and visual patterns</li>
                <li>Enhanced forecasting accuracy by <strong>70%</strong>, improving predictive capabilities for brands and consumers</li>
              </ul>
            </div>

            {/* TechJoy */}
            <div className="experience-item">
              <div className="experience-header">
                <h3 className="experience-title">Software Engineering Intern</h3>
                <span className="experience-company">TechJoy</span>
                <span className="experience-location">Madison, NJ</span>
                <span className="experience-period">May 2023 - Sept 2023</span>
              </div>
              <ul className="experience-bullets">
                <li>Increased deployment efficiency by <strong>25%</strong> and reduced post-deployment bugs by <strong>15%</strong> through the integration of Heroku CI/CD pipelines for staging and production</li>
                <li>Ensured correct application performance for the bike racing app OffroadFunFinder.com by implementing end-to-end testing with Cypress</li>
                <li>Executed comprehensive CRUD operations testing to validate the functionality and reliability of the application</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Media - Visual Showcase */}
      <section id="media" className="media-section">
        <div className="media-container">
          <h2 className="media-title">Media</h2>
          <div className="media-grid">
            {/* SurtAI Media */}
            <div className="media-item">
              {/* Insert AI-generated image here: Digital globe with security nodes */}
              <img 
                src="https://via.placeholder.com/600x400/5b7fa8/ffffff?text=SurtAI+Media" 
                alt="SurtAI - Digital Globe with Security Nodes"
                className="media-img"
              />
              <div className="media-overlay">
                <h3 className="media-item-title">SurtAI</h3>
                <p className="media-item-desc">Technical Product Management</p>
              </div>
            </div>

            {/* Drew Science Media */}
            <div className="media-item">
              {/* Insert AI-generated image here: Fashion meets AI neural network visualization */}
              <img 
                src="https://via.placeholder.com/600x400/7a9bc4/ffffff?text=Fashion+AI+Research" 
                alt="Fashion Meets AI - Neural Network Visualization"
                className="media-img"
              />
              <div className="media-overlay">
                <h3 className="media-item-title">Drew Science</h3>
                <p className="media-item-desc">Fashion Meets AI Research</p>
              </div>
            </div>

            {/* Beats By Dre Media */}
            <div className="media-item">
              {/* Insert AI-generated image here: High-end lifestyle photography of headphones and data */}
              <img 
                src="https://via.placeholder.com/600x400/9db5d1/ffffff?text=Beats+Data+Analytics" 
                alt="Beats By Dre - Lifestyle & Data Analytics"
                className="media-img"
              />
              <div className="media-overlay">
                <h3 className="media-item-title">Beats By Dre</h3>
                <p className="media-item-desc">Data Analytics & Marketing</p>
              </div>
            </div>

            {/* TechJoy Media */}
            <div className="media-item">
              {/* Insert AI-generated image here: Modern laptop on desk with code/development theme */}
              <img 
                src="https://via.placeholder.com/600x400/5b7fa8/ffffff?text=TechJoy+Development" 
                alt="TechJoy - Software Engineering"
                className="media-img"
              />
              <div className="media-overlay">
                <h3 className="media-item-title">TechJoy</h3>
                <p className="media-item-desc">Software Engineering & CI/CD</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Contact - Footer */}
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
