# Personal Portfolio Website

A modern, responsive React.js portfolio website with Home and About pages, designed to be hosted on GitHub Pages.

## Features

- 🏠 **Home Page**: Beautiful landing page with introduction and call-to-action buttons
- 👤 **About Page**: Detailed information about skills, services, and contact
- 📱 **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- 🎨 **Modern UI**: Gradient backgrounds, smooth animations, and glassmorphism effects
- 🚀 **GitHub Pages Ready**: Pre-configured for easy deployment

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `build` folder.

## Deployment to GitHub Pages

1. Make sure you have the `gh-pages` package installed (already included in package.json)

2. Update the `homepage` field in `package.json` with your GitHub username:
```json
"homepage": "https://YOUR_USERNAME.github.io"
```

3. Deploy to GitHub Pages:
```bash
npm run deploy
```

This will:
- Build the production version
- Deploy it to the `gh-pages` branch
- Make your site available at `https://YOUR_USERNAME.github.io`

## Customization

### Update Personal Information

- Edit `src/pages/Home.js` to change the home page content
- Edit `src/pages/About.js` to update your skills, services, and contact information
- Update the email and GitHub links in the About page

### Change Colors and Styling

- Modify CSS files in `src/` directory
- Update the gradient background in `src/index.css`
- Customize colors, fonts, and spacing to match your brand

## Project Structure

```
├── public/
│   └── index.html
├── src/
│   ├── pages/
│   │   ├── Home.js
│   │   ├── Home.css
│   │   ├── About.js
│   │   └── About.css
│   ├── App.js
│   ├── App.css
│   ├── index.js
│   └── index.css
├── package.json
└── README.md
```

## Technologies Used

- React 18
- React Router DOM
- CSS3 (with modern features like backdrop-filter, grid, flexbox)
- Create React App

## License

This project is open source and available under the MIT License.
