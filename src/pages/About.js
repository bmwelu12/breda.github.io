import React from 'react';
import './About.css';

function About() {
  return (
    <div className="about">
      <div className="about-container">
        <div className="about-header">
          <h1 className="about-title">About Me</h1>
          <p className="about-subtitle">Get to know me better</p>
        </div>
        
        <div className="about-content">
          <div className="about-section">
            <h2 className="section-title">Who I Am</h2>
            <p className="section-text">
              I'm a passionate developer with expertise in machine learning, web development,
              and data science. I enjoy building intelligent applications that solve real-world
              problems, from fashion recommendation systems to predictive analytics models.
            </p>
          </div>
          
          <div className="about-section">
            <h2 className="section-title">Skills & Technologies</h2>
            <div className="skills-grid">
              <div className="skill-item">
                <span className="skill-name">React</span>
              </div>
              <div className="skill-item">
                <span className="skill-name">JavaScript</span>
              </div>
              <div className="skill-item">
                <span className="skill-name">Python</span>
              </div>
              <div className="skill-item">
                <span className="skill-name">Machine Learning</span>
              </div>
              <div className="skill-item">
                <span className="skill-name">TypeScript</span>
              </div>
              <div className="skill-item">
                <span className="skill-name">Jupyter Notebook</span>
              </div>
              <div className="skill-item">
                <span className="skill-name">HTML/CSS</span>
              </div>
              <div className="skill-item">
                <span className="skill-name">Git</span>
              </div>
            </div>
          </div>
          
          <div className="about-section">
            <h2 className="section-title">What I Do</h2>
            <div className="services-grid">
              <div className="service-card">
                <div className="service-icon">🤖</div>
                <h3 className="service-title">Machine Learning</h3>
                <p className="service-description">
                  Building ML models for predictions, recommendations, and data analysis
                </p>
              </div>
              <div className="service-card">
                <div className="service-icon">💻</div>
                <h3 className="service-title">Web Development</h3>
                <p className="service-description">
                  Creating responsive and interactive web applications
                </p>
              </div>
              <div className="service-card">
                <div className="service-icon">📊</div>
                <h3 className="service-title">Data Science</h3>
                <p className="service-description">
                  Analyzing data and building predictive models for real-world problems
                </p>
              </div>
            </div>
          </div>
          
          <div className="about-section">
            <h2 className="section-title">Get In Touch</h2>
            <p className="section-text">
              I'm always open to discussing new projects, creative ideas, or
              opportunities to be part of your visions.
            </p>
            <div className="contact-buttons">
              <a href="mailto:your.email@example.com" className="btn btn-primary">
                Email Me
              </a>
              <a
                href="https://github.com/bmwelu12"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default About;
