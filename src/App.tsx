import { useState, useEffect } from 'react';
import { CADViewer } from './components/CADViewer';
import { ManufacturingSidebar } from './components/ManufacturingSidebar';
import { 
  Sun, Moon, Ruler, LayoutGrid, FileText
} from 'lucide-react';
import './App.css';

// Materials definition
const MATERIALS = [
  { name: 'Structural Steel (A36)', density: 7.85, category: 'metal' },
  { name: 'Aluminum Alloy (6061-T6)', density: 2.70, category: 'metal' },
  { name: 'Yellow Brass (C360)', density: 8.40, category: 'metal' },
  { name: 'Stainless Steel (304)', density: 8.00, category: 'metal' },
  { name: 'Nylon 101 Polyamide', density: 1.14, category: 'polymer' },
  { name: 'ABS Thermoplastic', density: 1.04, category: 'polymer' },
  { name: 'Delrin Acetal (POM)', density: 1.42, category: 'polymer' },
];

interface Measurement {
  id: string;
  p1: any;
  p2: any;
  distance: number;
}

function App() {
  // Theme state (default dark)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  
  // Model state
  const [modelType, setModelType] = useState<string>('bracket');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  
  // Rules and settings states
  const [boundingRule, setBoundingRule] = useState<'box' | 'cylinder'>('box');
  const [unit, setUnit] = useState<'mm' | 'in'>('mm');
  const [materialName, setMaterialName] = useState<string>('Structural Steel (A36)');
  
  // Metrics calculated by Three.js
  const [modelMetrics, setModelMetrics] = useState<{
    volume: number;
    surfaceArea: number;
    boxDimensions: { x: number; y: number; z: number };
    cylinderDimensions: { radius: number; height: number; axis: string };
    triangleCount: number;
  } | null>(null);

  // 2D Blueprint view
  const [isBlueprintMode, setIsBlueprintMode] = useState<boolean>(false);

  // Measurement tape states
  const [measureMode, setMeasureMode] = useState<boolean>(false);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  // Update root attribute when theme toggles
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Clean measurements on model change
  useEffect(() => {
    setMeasurements([]);
    setMeasureMode(false);
  }, [modelType, uploadedFile]);

  // Clear all measurements
  const clearMeasurements = () => {
    setMeasurements([]);
    setMeasureMode(false);
  };

  // Remove a single tape point
  const removeMeasurement = (id: string) => {
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="app-header">
        <div className="logo-section">
          <h1>Antigravity CAD</h1>
          <span className="model-badge">
            {uploadedFile ? uploadedFile.name : `${modelType.toUpperCase()} MODEL`}
          </span>
        </div>

        {/* Header Actions */}
        <div className="header-actions">
          {/* 3D vs 2D Blueprint Toggle */}
          <div className="toggle-group">
            <button 
              className={`toggle-btn ${!isBlueprintMode ? 'active' : ''}`}
              onClick={() => {
                setIsBlueprintMode(false);
                setMeasureMode(false);
              }}
            >
              <LayoutGrid size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
              3D Workspace
            </button>
            <button 
              className={`toggle-btn ${isBlueprintMode ? 'active' : ''}`}
              onClick={() => {
                setIsBlueprintMode(true);
                setMeasureMode(false);
              }}
            >
              <FileText size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
              2D Blueprint
            </button>
          </div>

          {/* Tape Measure Trigger */}
          <button 
            className={`action-btn ${measureMode ? 'active' : ''}`}
            onClick={() => setMeasureMode(!measureMode)}
            title="Interactive two-point tape measure"
            disabled={isBlueprintMode}
            style={{ opacity: isBlueprintMode ? 0.5 : 1, cursor: isBlueprintMode ? 'not-allowed' : 'pointer' }}
          >
            <Ruler size={14} />
            Measure Tool
          </button>

          {/* Unit Switcher */}
          <div className="toggle-group">
            <button 
              className={`toggle-btn ${unit === 'mm' ? 'active' : ''}`}
              onClick={() => setUnit('mm')}
            >
              Metric (mm)
            </button>
            <button 
              className={`toggle-btn ${unit === 'in' ? 'active' : ''}`}
              onClick={() => setUnit('in')}
            >
              Imperial (in)
            </button>
          </div>

          {/* Day / Night Theme Toggler */}
          <button 
            className="action-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${theme === 'dark' ? 'Day' : 'Night'} Mode`}
            style={{ width: '40px', height: '40px', padding: 0, justifyContent: 'center' }}
          >
            {theme === 'dark' ? <Sun size={18} style={{ color: '#fbbf24' }} /> : <Moon size={18} style={{ color: '#4f46e5' }} />}
          </button>
        </div>
      </header>

      {/* Main Layout Area */}
      <main className="main-layout">
        {/* Three.js viewport */}
        <CADViewer 
          theme={theme}
          modelType={modelType}
          uploadedFile={uploadedFile}
          boundingRule={boundingRule}
          unit={unit}
          onModelLoaded={setModelMetrics}
          isBlueprintMode={isBlueprintMode}
          measureMode={measureMode}
          setMeasureMode={setMeasureMode}
          measurements={measurements}
          setMeasurements={setMeasurements}
        />

        {/* Settings and manufacturing advice panel */}
        <ManufacturingSidebar 
          modelType={modelType}
          setModelType={setModelType}
          setUploadedFile={setUploadedFile}
          boundingRule={boundingRule}
          setBoundingRule={setBoundingRule}
          unit={unit}
          materialName={materialName}
          setMaterialName={setMaterialName}
          materials={MATERIALS}
          modelMetrics={modelMetrics}
          measurements={measurements}
          clearMeasurements={clearMeasurements}
          removeMeasurement={removeMeasurement}
        />
      </main>
    </div>
  );
}

export default App;
