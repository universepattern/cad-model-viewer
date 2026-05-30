# Antigravity CAD - Premium 3D/2D CAD Viewer & Analyzer

A high-performance, responsive 3D and 2D CAD model viewer built with React, TypeScript, Vite, and Three.js. This application is optimized for web deployment, specifically tailored for GitHub Pages.

Test it: https://universepattern.github.io/cad-model-viewer/

## Core Features

- **Dual-Theme Design (Day / Night Mode):** Full visual workspace adjustments between a dark engineering canvas (default) and a bright grid panel, using CSS custom properties for smooth theme transitions.
- **Interactive Measurement Tool:** Click any two points on the 3D model to place anchor pins, draw an interconnecting measurement dimension line, and display dynamic floating tags.
- **Metric & Imperial Scaling:** Seamless on-the-fly distance conversions between **millimeters (mm)** and **inches (in)**.
- **Automatic Stock Envelope Fitting (Box vs. Cylinder rules):**
  - **Box Rule:** Computes bounding boundaries across standard orthogonal planes ($X \times Y \times Z$).
  - **Cylinder Rule:** Resolves the optimal rotational layout axis (X, Y, or Z) to fit the smallest stock cylinder enclosing the shape (Diameter $\times$ Length).
  - Highlighting outlines are rendered as a custom **semi-transparent light-yellow mesh (opacity 0.22)** with a dark yellow wireframe.
- **Engineering Reasoning Engine:** Generates real-time manufacturing advice based on the model's metrics:
  - Select from a list of materials (**Structural Steel, Aluminum, Yellow Brass, Stainless Steel, Nylon, ABS, Delrin**) to estimate physical part weight.
  - Suggests processing pathways (e.g. recommending CNC Turning for cylindrical geometries, CNC Milling for cubic layouts, or 3D Printing for high-complexity parts).
- **2D Blueprint projection overlay:** Projects 3D geometry onto a technical parallel plane with an ANSI/ISO title block frame showing drawing details.
- **Quick Camera Snap orientations:** Quickly align perspective camera angles to standard views: **Front, Back, Top, Bottom, Left, Right, and Isometric**.
- **Custom STL Upload:** Upload local `.stl` files directly for instant parsing and calculation.

## Technology Stack

- **Framework:** React 19, TypeScript
- **Bundler:** Vite
- **Graphics Engine:** Three.js (WebGLRenderer, STLLoader, OrbitControls)
- **Icons:** Lucide-React
- **CI/CD:** GitHub Actions (Automated static pages deployment on push to `main`)

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/universepattern/cad-model-viewer.git
   cd cad-model-viewer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run locally:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```
