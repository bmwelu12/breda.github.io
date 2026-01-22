import React, { useEffect, useState } from 'react';
import './About.css';

function About() {
  const [visibleSections, setVisibleSections] = useState({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => ({
              ...prev,
              [entry.target.className]: true,
            }));
          }
        });
      },
      { threshold: 0.1 }
    );

    const sections = document.querySelectorAll('.about-section, .skill-item, .service-card');
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="about" id="about-section">
      <div className="about-container">
        <div className="about-header">
          <h1 className="about-title">About Me</h1>
          <p className="about-subtitle">Get to know me better</p>
        </div>
        
        <div className="about-content">
          <div className="about-section">
            <h2 className="section-title">Education</h2>
            <div className="education-item">
              <h3 className="education-title">Drew University, Madison, NJ</h3>
              <p className="education-degree">Bachelor of Science in Computer Science and French (Double Major)</p>
              <p className="education-details">GPA: 3.63 | Honors: Dean's List, Pi Delta Phi</p>
              <p className="education-details">Study Abroad: Alliance Française, Paris, France (June–July 2022)</p>
            </div>
          </div>
          
          <div className="about-section">
            <h2 className="section-title">Who I Am</h2>
            <p className="section-text">
              I'm a Technical Product Manager and Full-Stack Developer with a passion for building 
              innovative solutions. Currently serving as Technical Product Manager at SurtAI, I lead 
              cross-functional teams to deliver IDV and Geolocation features. My background combines 
              strong technical skills in machine learning and web development with product management 
              expertise, enabling me to translate complex requirements into successful technical solutions.
            </p>
          </div>
          
          <div className="about-section">
            <h2 className="section-title">Technical Skills</h2>
            <div className="skills-category">
              <h3 className="skills-subtitle">Programming Languages</h3>
              <div className="skills-grid">
                <div className="skill-item"><span className="skill-name">Java</span></div>
                <div className="skill-item"><span className="skill-name">Python</span></div>
                <div className="skill-item"><span className="skill-name">SQL</span></div>
                <div className="skill-item"><span className="skill-name">C</span></div>
                <div className="skill-item"><span className="skill-name">HTML</span></div>
                <div className="skill-item"><span className="skill-name">CSS</span></div>
                <div className="skill-item"><span className="skill-name">JavaScript</span></div>
                <div className="skill-item"><span className="skill-name">TypeScript</span></div>
              </div>
            </div>
            <div className="skills-category">
              <h3 className="skills-subtitle">Frameworks & Libraries</h3>
              <div className="skills-grid">
                <div className="skill-item"><span className="skill-name">Django</span></div>
                <div className="skill-item"><span className="skill-name">React.js</span></div>
                <div className="skill-item"><span className="skill-name">Node.js</span></div>
                <div className="skill-item"><span className="skill-name">TensorFlow</span></div>
                <div className="skill-item"><span className="skill-name">Keras</span></div>
                <div className="skill-item"><span className="skill-name">NumPy</span></div>
                <div className="skill-item"><span className="skill-name">Pandas</span></div>
                <div className="skill-item"><span className="skill-name">Scikit-learn</span></div>
              </div>
            </div>
            <div className="skills-category">
              <h3 className="skills-subtitle">Tools & Databases</h3>
              <div className="skills-grid">
                <div className="skill-item"><span className="skill-name">Jupyter Notebook</span></div>
                <div className="skill-item"><span className="skill-name">Git</span></div>
                <div className="skill-item"><span className="skill-name">MySQL</span></div>
                <div className="skill-item"><span className="skill-name">PostgreSQL</span></div>
                <div className="skill-item"><span className="skill-name">Tableau</span></div>
                <div className="skill-item"><span className="skill-name">Retool</span></div>
                <div className="skill-item"><span className="skill-name">JIRA</span></div>
                <div className="skill-item"><span className="skill-name">Zendesk</span></div>
              </div>
            </div>
          </div>
          
          <div className="about-section">
            <h2 className="section-title">Professional Experience</h2>
            <div className="experience-item">
              <div className="experience-header">
                <h3 className="experience-title">Technical Product Manager</h3>
                <span className="experience-company">SurtAI, Boston, MA</span>
                <span className="experience-date">Oct 2025 - Present</span>
              </div>
              <ul className="experience-list">
                <li>Serve as sole technical product and project manager building IDV and Geolocation features launching for 4 clients in 3 months</li>
                <li>Manage offshore and near shore engineering team, owning roadmap, backlog, and cross-time-zone delivery</li>
                <li>Design and integrate verification flows, balancing compliance, fraud risk and user experience</li>
                <li>Lead 0 to 1 build and successful client launches, translating regulatory requirements into technical specifications</li>
              </ul>
            </div>
            <div className="experience-item">
              <div className="experience-header">
                <h3 className="experience-title">Consumer Data Analyst Intern</h3>
                <span className="experience-company">Beats By Dre, New York, NY</span>
                <span className="experience-date">Jun 2024 - Aug 2024</span>
              </div>
              <ul className="experience-list">
                <li>Achieved a 10% increase in targeted marketing effectiveness by informing strategic brand and marketing decisions</li>
                <li>Collected and analyzed data from over 500 surveys, integrating both quantitative and qualitative findings</li>
                <li>Delivered actionable insights through three detailed reports and two visual summaries based on in-depth research</li>
              </ul>
            </div>
            <div className="experience-item">
              <div className="experience-header">
                <h3 className="experience-title">Machine Learning Researcher</h3>
                <span className="experience-company">Drew Summer Science Institute, Madison, NJ</span>
                <span className="experience-date">Jun 2023 - Aug 2023</span>
              </div>
              <ul className="experience-list">
                <li>Analyzed 15,000 Vogue Runway photos and 1,000 social media images using object detection and image classification</li>
                <li>Applied LSTM models for time series analysis, predicting fashion trends from historical data and visual patterns</li>
                <li>Enhanced forecasting accuracy by 70%, improving predictive capabilities for brands and consumers</li>
              </ul>
            </div>
            <div className="experience-item">
              <div className="experience-header">
                <h3 className="experience-title">Software Engineering Intern</h3>
                <span className="experience-company">TechJoy, Madison, NJ</span>
                <span className="experience-date">May 2023 - Sept 2023</span>
              </div>
              <ul className="experience-list">
                <li>Increased deployment efficiency by 25% and reduced post-deployment bugs by 15% through Heroku CI/CD pipelines</li>
                <li>Ensured correct application performance for OffroadFunFinder.com by implementing end-to-end testing with Cypress</li>
                <li>Executed comprehensive CRUD operations testing to validate functionality and reliability</li>
              </ul>
            </div>
          </div>
          
          <div className="about-section">
            <h2 className="section-title">Projects</h2>
            <div className="project-item">
              <h3 className="project-title">OffroadFunFinder</h3>
              <p className="project-link"><a href="http://offroadfunfinder.com" target="_blank" rel="noopener noreferrer">offroadfunfinder.com</a></p>
              <p className="project-description">
                A bike racing app with a React Native frontend and Django backend that allows users to find tracks 
                and training events nationwide while completing tasks and winning prizes. Implemented end-to-end 
                testing with Cypress to ensure correct application performance.
              </p>
            </div>
            <div className="project-item">
              <h3 className="project-title">Fashion Recommendation System</h3>
              <p className="project-description">
                Designed a collaborative filtering model in Python using TensorFlow, Pandas, and Jupyter Notebook 
                to recommend rental outfits based on customer attributes such as body type and rental purpose 
                (e.g., weddings, vacations, business). Improved recommendation relevance by 30% through user 
                clustering and similarity-based prediction techniques.
              </p>
            </div>
          </div>
          
          <div className="about-section">
            <h2 className="section-title">Get In Touch</h2>
            <p className="section-text">
              I'm always open to discussing new projects, creative ideas, or
              opportunities to be part of your visions.
            </p>
            <div className="contact-info">
              <p className="contact-item">
                <strong>Email:</strong> <a href="mailto:simonbreda0@gmail.com">simonbreda0@gmail.com</a>
              </p>
              <p className="contact-item">
                <strong>GitHub:</strong> <a href="https://github.com/bmwelu12" target="_blank" rel="noopener noreferrer">github.com/bmwelu12</a>
              </p>
              <p className="contact-item">
                <strong>LinkedIn:</strong> <a href="https://www.linkedin.com/in/breda-m-87276b1a3/" target="_blank" rel="noopener noreferrer">linkedin.com/in/breda-m-87276b1a3</a>
              </p>
            </div>
            <div className="contact-buttons">
              <a href="mailto:simonbreda0@gmail.com" className="btn btn-primary">
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
              <a
                href="https://www.linkedin.com/in/breda-m-87276b1a3/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default About;
