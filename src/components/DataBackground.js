import React, { useEffect, useRef } from 'react';
import './DataBackground.css';

function DataBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let charts = [];
    let metrics = [];
    let trendLines = [];
    let scrollY = 0;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const handleScroll = () => {
      scrollY = window.pageYOffset || document.documentElement.scrollTop;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('scroll', handleScroll);

    // Financial Line Chart
    class LineChart {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * (canvas.width - 200) + 100;
        this.y = Math.random() * (canvas.height - 150) + 75;
        this.width = 150 + Math.random() * 100;
        this.height = 80 + Math.random() * 60;
        this.points = [];
        this.opacity = Math.random() * 0.15 + 0.05;
        this.hue = 210 + Math.random() * 20;
        
        // Generate data points
        const pointCount = 8 + Math.floor(Math.random() * 5);
        for (let i = 0; i < pointCount; i++) {
          this.points.push({
            x: (i / (pointCount - 1)) * this.width,
            y: Math.random() * this.height
          });
        }
      }

      update(scrollY) {
        // Store original position
        if (!this.originalX) {
          this.originalX = this.x;
          this.originalY = this.y;
        }
        
        // React to scroll with parallax
        this.x = this.originalX + Math.sin(scrollY * 0.001 + this.originalY * 0.01) * 20;
        this.y = this.originalY + Math.cos(scrollY * 0.001 + this.originalX * 0.01) * 15;
        
        // Slight movement
        this.x += Math.sin(Date.now() * 0.0001 + this.y) * 0.1;
        this.y += Math.cos(Date.now() * 0.0001 + this.x) * 0.1;
      }

      draw(scrollY) {
        ctx.save();
        const scrollScale = 1 + (scrollY * 0.0001);
        const scrollRotation = scrollY * 0.00005;
        ctx.globalAlpha = this.opacity * (0.8 + Math.sin(scrollY * 0.01) * 0.2);
        ctx.translate(this.x, this.y);
        ctx.scale(scrollScale, scrollScale);
        ctx.rotate(scrollRotation);
        
        // Draw grid lines
        ctx.strokeStyle = `hsla(${this.hue}, 50%, 50%, 0.1)`;
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 4; i++) {
          const y = (i / 4) * this.height;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(this.width, y);
          ctx.stroke();
        }

        // Draw smooth curved line chart using bezier curves
        ctx.strokeStyle = `hsl(${this.hue}, 70%, 60%)`;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        
        if (this.points.length > 0) {
          const firstY = this.height - this.points[0].y;
          ctx.moveTo(this.points[0].x, firstY);
          
          // Use bezier curves for smooth rounded lines
          for (let i = 0; i < this.points.length - 1; i++) {
            const currentPoint = this.points[i];
            const nextPoint = this.points[i + 1];
            const currentY = this.height - currentPoint.y;
            const nextY = this.height - nextPoint.y;
            
            // Calculate control points for smooth bezier curve
            const cp1x = currentPoint.x + (nextPoint.x - currentPoint.x) / 3;
            const cp1y = currentY;
            const cp2x = currentPoint.x + 2 * (nextPoint.x - currentPoint.x) / 3;
            const cp2y = nextY;
            
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, nextPoint.x, nextY);
          }
        }
        ctx.stroke();

        // Draw data points
        ctx.fillStyle = `hsl(${this.hue}, 70%, 60%)`;
        this.points.forEach(point => {
          ctx.beginPath();
          ctx.arc(point.x, this.height - point.y, 2, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.restore();
      }
    }

    // Bar Chart
    class BarChart {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * (canvas.width - 200) + 100;
        this.y = Math.random() * (canvas.height - 150) + 75;
        this.width = 120 + Math.random() * 80;
        this.height = 80 + Math.random() * 60;
        this.bars = [];
        this.opacity = Math.random() * 0.15 + 0.05;
        this.hue = 210 + Math.random() * 20;
        
        const barCount = 5 + Math.floor(Math.random() * 4);
        const barWidth = this.width / (barCount + 1);
        for (let i = 0; i < barCount; i++) {
          this.bars.push({
            x: (i + 1) * barWidth,
            height: Math.random() * this.height * 0.8
          });
        }
      }

      update(scrollY) {
        // Store original position
        if (!this.originalX) {
          this.originalX = this.x;
          this.originalY = this.y;
        }
        
        // React to scroll with parallax
        this.x = this.originalX + Math.cos(scrollY * 0.001 + this.originalY * 0.01) * 15;
        this.y = this.originalY + Math.sin(scrollY * 0.001 + this.originalX * 0.01) * 10;
        
        // Slight movement
        this.x += Math.cos(Date.now() * 0.0001 + this.y) * 0.1;
        this.y += Math.sin(Date.now() * 0.0001 + this.x) * 0.1;
      }

      draw(scrollY) {
        ctx.save();
        const scrollScale = 1 + (scrollY * 0.00008);
        const scrollRotation = scrollY * 0.00003;
        ctx.globalAlpha = this.opacity * (0.8 + Math.cos(scrollY * 0.01) * 0.2);
        ctx.translate(this.x, this.y);
        ctx.scale(scrollScale, scrollScale);
        ctx.rotate(scrollRotation);
        
        // Draw bars with scroll-based height variation
        this.bars.forEach((bar, i) => {
          const scrollHeight = bar.height * (1 + Math.sin(scrollY * 0.005 + i) * 0.1);
          ctx.fillStyle = `hsl(${this.hue}, 70%, 60%)`;
          ctx.fillRect(bar.x - 8, this.height - scrollHeight, 16, scrollHeight);
        });

        ctx.restore();
      }
    }

    // Marketing Metrics
    class Metric {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.value = (Math.random() * 100).toFixed(1) + '%';
        this.label = ['ROI', 'CTR', 'CVR', 'LTV', 'AOV', 'CAC', 'MRR', 'ARR'][Math.floor(Math.random() * 8)];
        this.size = Math.random() * 10 + 8;
        this.speed = Math.random() * 0.3 + 0.1;
        this.opacity = Math.random() * 0.2 + 0.1;
        this.hue = 200 + Math.random() * 60;
        this.angle = Math.random() * Math.PI * 2;
      }

      update(scrollY) {
        // Store original position
        if (!this.originalX) {
          this.originalX = this.x;
          this.originalY = this.y;
        }
        
        // React to scroll with parallax effect
        const parallaxX = scrollY * 0.05;
        const parallaxY = scrollY * 0.03;
        this.x = this.originalX + Math.cos(this.angle) * this.speed + parallaxX;
        this.y = this.originalY + Math.sin(this.angle) * this.speed + parallaxY;

        if (this.x < -50 || this.x > canvas.width + 50) {
          this.angle = Math.PI - this.angle;
        }
        if (this.y < -50 || this.y > canvas.height + 50) {
          this.angle = -this.angle;
        }
      }

      draw(scrollY) {
        ctx.save();
        const scrollScale = 1 + Math.sin(scrollY * 0.002 + this.x * 0.01) * 0.1;
        const scrollRotation = scrollY * 0.0001;
        ctx.globalAlpha = this.opacity * (0.7 + Math.sin(scrollY * 0.01 + this.y * 0.01) * 0.3);
        ctx.translate(this.x, this.y);
        ctx.scale(scrollScale, scrollScale);
        ctx.rotate(scrollRotation);
        ctx.fillStyle = `hsl(${this.hue}, 70%, 60%)`;
        ctx.font = `${this.size}px 'Courier New', monospace`;
        ctx.fillText(this.label, 0, 0);
        ctx.font = `${this.size * 0.7}px 'Courier New', monospace`;
        ctx.fillText(this.value, 0, this.size + 2);
        ctx.restore();
      }
    }

    // Trend Line (like stock chart)
    class TrendLine {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.length = 200 + Math.random() * 150;
        this.angle = Math.random() * Math.PI * 0.5 - Math.PI * 0.25;
        this.points = [];
        this.opacity = Math.random() * 0.2 + 0.05;
        this.hue = 200 + Math.random() * 60;
        
        // Generate trend points
        const pointCount = 15 + Math.floor(Math.random() * 10);
        for (let i = 0; i < pointCount; i++) {
          this.points.push({
            x: (i / (pointCount - 1)) * this.length,
            y: Math.sin(i * 0.5) * 30 + (Math.random() - 0.5) * 20
          });
        }
      }

      update(scrollY) {
        // Store original position
        if (!this.originalX) {
          this.originalX = this.x;
          this.originalY = this.y;
        }
        
        // Strong parallax effect for trend lines
        const parallaxX = scrollY * 0.15;
        const parallaxY = scrollY * 0.1;
        this.x = this.originalX + Math.cos(this.angle) * 0.2 + parallaxX;
        this.y = this.originalY + Math.sin(this.angle) * 0.2 + parallaxY;

        if (this.x < -this.length || this.x > canvas.width + this.length ||
            this.y < -this.length || this.y > canvas.height + this.length) {
          this.reset();
          this.originalX = null;
          this.originalY = null;
        }
      }

      draw(scrollY) {
        ctx.save();
        const scrollScale = 1 + (scrollY * 0.0002);
        const scrollRotation = this.angle + scrollY * 0.0001;
        ctx.globalAlpha = this.opacity * (0.6 + Math.sin(scrollY * 0.008) * 0.4);
        ctx.translate(this.x, this.y);
        ctx.rotate(scrollRotation);
        ctx.scale(scrollScale, scrollScale);
        
        ctx.strokeStyle = `hsl(${this.hue}, 70%, 60%)`;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        
        if (this.points.length > 0) {
          const scrollOffset0 = Math.sin(scrollY * 0.01 + 0) * 5;
          ctx.moveTo(this.points[0].x, this.points[0].y + scrollOffset0);
          
          // Use bezier curves for smooth rounded trend lines
          for (let i = 0; i < this.points.length - 1; i++) {
            const currentPoint = this.points[i];
            const nextPoint = this.points[i + 1];
            const scrollOffset = Math.sin(scrollY * 0.01 + i) * 5;
            const nextScrollOffset = Math.sin(scrollY * 0.01 + i + 1) * 5;
            
            const currentY = currentPoint.y + scrollOffset;
            const nextY = nextPoint.y + nextScrollOffset;
            
            // Calculate control points for smooth bezier curve
            const cp1x = currentPoint.x + (nextPoint.x - currentPoint.x) / 3;
            const cp1y = currentY;
            const cp2x = currentPoint.x + 2 * (nextPoint.x - currentPoint.x) / 3;
            const cp2y = nextY;
            
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, nextPoint.x, nextY);
          }
        }
        ctx.stroke();

        // Draw gradient fill under line with scroll variation
        ctx.fillStyle = `hsla(${this.hue}, 70%, 60%, ${0.1 + Math.sin(scrollY * 0.01) * 0.05})`;
        ctx.lineTo(this.length, 0);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }
    }

    // Initialize elements
    for (let i = 0; i < 4; i++) {
      charts.push(new LineChart());
    }
    for (let i = 0; i < 3; i++) {
      charts.push(new BarChart());
    }
    for (let i = 0; i < 12; i++) {
      metrics.push(new Metric());
    }
    for (let i = 0; i < 6; i++) {
      trendLines.push(new TrendLine());
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw charts
      charts.forEach(chart => {
        chart.update(scrollY);
        chart.draw(scrollY);
      });

      // Draw trend lines
      trendLines.forEach(line => {
        line.update(scrollY);
        line.draw(scrollY);
      });

      // Draw metrics
      metrics.forEach(metric => {
        metric.update(scrollY);
        metric.draw(scrollY);
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="data-background" />;
}

export default DataBackground;
