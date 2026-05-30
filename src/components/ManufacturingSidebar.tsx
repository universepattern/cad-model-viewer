import React, { useRef } from 'react';
import { 
  Box, Layers, Trash2, Cpu, Scale, Compass, 
  Settings, UploadCloud, Award
} from 'lucide-react';

interface Measurement {
  id: string;
  p1: any;
  p2: any;
  distance: number;
}

interface ManufacturingSidebarProps {
  modelType: string;
  setModelType: (type: string) => void;
  setUploadedFile: (file: File | null) => void;
  boundingRule: 'box' | 'cylinder';
  setBoundingRule: (rule: 'box' | 'cylinder') => void;
  unit: 'mm' | 'in';
  materialName: string;
  setMaterialName: (name: string) => void;
  materials: { name: string; density: number; category: string }[];
  modelMetrics: {
    volume: number;
    surfaceArea: number;
    boxDimensions: { x: number; y: number; z: number };
    cylinderDimensions: { radius: number; height: number; axis: string };
    triangleCount: number;
  } | null;
  measurements: Measurement[];
  clearMeasurements: () => void;
  removeMeasurement: (id: string) => void;
}

export const ManufacturingSidebar: React.FC<ManufacturingSidebarProps> = ({
  modelType,
  setModelType,
  setUploadedFile,
  boundingRule,
  setBoundingRule,
  unit,
  materialName,
  setMaterialName,
  materials,
  modelMetrics,
  measurements,
  clearMeasurements,
  removeMeasurement,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse units
  const toUnit = (valMm: number) => {
    if (unit === 'in') {
      return (valMm / 25.4).toFixed(3);
    }
    return valMm.toFixed(1);
  };

  const getUnitSymbol = () => (unit === 'in' ? '"' : ' mm');

  const selectedMaterial = materials.find((m) => m.name === materialName) || materials[0];

  // Weight Calculation: Mass = Density * Volume
  // Volume is in mm^3, density is in g/cm^3.
  // 1 cm^3 = 1000 mm^3. So Volume(cm^3) = Volume(mm^3) / 1000.
  // Mass(g) = density (g/cm^3) * (Volume(mm^3) / 1000)
  const calculateWeight = () => {
    if (!modelMetrics) return '0.0 g';
    const volCm3 = modelMetrics.volume / 1000;
    const massG = volCm3 * selectedMaterial.density;
    
    if (massG > 1000) {
      return `${(massG / 1000).toFixed(2)} kg (${((massG / 1000) * 2.20462).toFixed(2)} lbs)`;
    }
    return `${massG.toFixed(1)} g (${(massG * 0.035274).toFixed(2)} oz)`;
  };

  // Drag and Drop files
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.stl')) {
        setUploadedFile(file);
      } else {
        alert('Please upload a valid .stl file');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  // Manufacturing Reasoning Engine
  const generateManufacturingInsights = () => {
    if (!modelMetrics) return [];

    const insights = [];
    const box = modelMetrics.boxDimensions;
    const cyl = modelMetrics.cylinderDimensions;

    const boxVol = box.x * box.y * box.z;
    const cylVol = Math.PI * cyl.radius * cyl.radius * cyl.height;

    // 1. Process choice: Turning vs Milling vs 3D printing
    const isCylindrical = cylVol < boxVol * 0.85; // Cylinder fits the volume much tighter than the box
    
    if (isCylindrical) {
      insights.push({
        title: 'CNC Turning Recommended',
        type: 'success',
        body: `Highly cylindrical outline detected. Stock bounding cylinder volume (${(cylVol/1000).toFixed(1)} cm³) is ${( (boxVol - cylVol)/1000 ).toFixed(1)} cm³ smaller than box bounding volume. Lathe machining will minimize swarf waste.`,
        badge: 'Turning'
      });
    } else {
      insights.push({
        title: 'CNC Milling Recommended',
        type: 'success',
        body: `Orthogonal cubic block geometry matches standard mill layouts. CNC 3-axis or 5-axis vertical machining will deliver optimal feature alignments and speeds.`,
        badge: 'Milling'
      });
    }

    // 2. Additive manufacturing suitability
    if (modelMetrics.triangleCount > 50000 || modelMetrics.volume < 15000) {
      insights.push({
        title: 'SLS/SLA 3D Printing Suitable',
        type: 'info',
        body: 'High detail complexity or small volumetric size makes this part cost-effective for SLS/SLA additive polymer sintering, bypassing expensive machining tooling setup.',
        badge: '3D Print'
      });
    }

    // 3. Size warning / Machining envelope
    const maxDim = Math.max(box.x, box.y, box.z);
    if (maxDim > 300) {
      insights.push({
        title: 'Large Dimension Warning',
        type: 'warning',
        body: `Model height/length exceeds 300mm. Standard milling beds may require double setups or specialized indexing jigs. Consider sectioning or standardizing profiles.`,
        badge: 'Setup Envelope'
      });
    }

    // 4. Material weight feedback
    if (selectedMaterial.category === 'metal') {
      insights.push({
        title: 'High Thermal Dissipation Metal',
        type: 'info',
        body: `Using ${selectedMaterial.name}. High tensile strengths require carbide tooling inserts and high pressure coolant to maintain dimensional tolerances under 0.05 mm.`,
        badge: 'Tooling Speed'
      });
    } else {
      insights.push({
        title: 'Rapid Engineering Polymer',
        type: 'info',
        body: `Using engineering ${selectedMaterial.name}. Tool feeds can run at high speed (SFM), but thermal warping or bending must be mitigated by using lower clamp clamping forces.`,
        badge: 'Clamping Pressure'
      });
    }

    return insights;
  };

  const insights = generateManufacturingInsights();

  return (
    <aside className="sidebar">
      {/* 1. Model Selector / Loader */}
      <div className="sidebar-section">
        <h3 className="sidebar-title">
          <Layers size={16} /> CAD Model Input
        </h3>
        
        <select 
          className="form-select"
          value={modelType}
          onChange={(e) => {
            setUploadedFile(null); // Clear manual upload
            setModelType(e.target.value);
          }}
        >
          <option value="bracket">L-Bracket (Milling)</option>
          <option value="shaft">Stepped Drive Shaft (Turning)</option>
          <option value="flange">Piping Hub Flange (Turning/Drilling)</option>
          <option value="box">Electronic Enclosure (Box rule)</option>
        </select>

        {/* Local file upload */}
        <div 
          className="uploader-box"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud className="uploader-icon mx-auto" size={24} style={{ margin: '0 auto 8px auto' }} />
          <div className="uploader-text">Upload custom STL file</div>
          <div className="uploader-subtext">Drag & drop or click to browse</div>
          <input 
            type="file" 
            ref={fileInputRef}
            className="file-upload-input"
            accept=".stl"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* 2. Bounding Fit Rule Config */}
      <div className="sidebar-section">
        <h3 className="sidebar-title">
          <Box size={16} /> Bounding Fit Shape
        </h3>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
          Select the enclosing bounding envelope rule. Calculates material stock volume and highlights geometry in semi-transparent yellow.
        </p>

        <div className="rule-toggle-container">
          <div 
            className={`rule-card ${boundingRule === 'box' ? 'active' : ''}`}
            onClick={() => setBoundingRule('box')}
          >
            <Box className="rule-card-icon" size={16} />
            <div className="rule-card-details">
              <h4>Box Rule</h4>
              <p>Orthogonal Cuboid</p>
            </div>
          </div>
          
          <div 
            className={`rule-card ${boundingRule === 'cylinder' ? 'active' : ''}`}
            onClick={() => setBoundingRule('cylinder')}
          >
            <Compass className="rule-card-icon" size={16} />
            <div className="rule-card-details">
              <h4>Cylinder Rule</h4>
              <p>Radial Envelope</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Physical Parameters & Material selector */}
      <div className="sidebar-section">
        <h3 className="sidebar-title">
          <Scale size={16} /> Material & Weight Analysis
        </h3>
        
        <select 
          className="form-select"
          value={materialName}
          onChange={(e) => setMaterialName(e.target.value)}
        >
          {materials.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name} ({m.density.toFixed(2)} g/cm³)
            </option>
          ))}
        </select>

        {modelMetrics && (
          <div className="details-list" style={{ marginTop: '12px' }}>
            <div className="details-row">
              <span className="details-key">Estimated Weight:</span>
              <span className="details-val" style={{ color: 'var(--accent-color)' }}>
                {calculateWeight()}
              </span>
            </div>
            <div className="details-row">
              <span className="details-key">Volume:</span>
              <span className="details-val">{(modelMetrics.volume / 1000).toFixed(2)} cm³</span>
            </div>
            <div className="details-row">
              <span className="details-key">Surface Area:</span>
              <span className="details-val">{(modelMetrics.surfaceArea / 100).toFixed(2)} cm²</span>
            </div>
            <div className="details-row">
              <span className="details-key">Triangle Count:</span>
              <span className="details-val">{modelMetrics.triangleCount.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. Enclosing Dimensions Details */}
      <div className="sidebar-section">
        <h3 className="sidebar-title">
          <Settings size={16} /> Enveloping Dimensions
        </h3>
        {modelMetrics && (
          <div>
            {boundingRule === 'box' ? (
              <div className="dimension-grid">
                <div className="dimension-card">
                  <span className="dimension-label">Width (X)</span>
                  <span className="dimension-value">
                    {toUnit(modelMetrics.boxDimensions.x)}{getUnitSymbol()}
                  </span>
                </div>
                <div className="dimension-card">
                  <span className="dimension-label">Height (Y)</span>
                  <span className="dimension-value">
                    {toUnit(modelMetrics.boxDimensions.y)}{getUnitSymbol()}
                  </span>
                </div>
                <div className="dimension-card" style={{ gridColumn: 'span 2' }}>
                  <span className="dimension-label">Depth (Z)</span>
                  <span className="dimension-value">
                    {toUnit(modelMetrics.boxDimensions.z)}{getUnitSymbol()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="dimension-grid">
                <div className="dimension-card">
                  <span className="dimension-label">Diameter (Ø)</span>
                  <span className="dimension-value">
                    {toUnit(modelMetrics.cylinderDimensions.radius * 2)}{getUnitSymbol()}
                  </span>
                </div>
                <div className="dimension-card">
                  <span className="dimension-label">Height / Length</span>
                  <span className="dimension-value">
                    {toUnit(modelMetrics.cylinderDimensions.height)}{getUnitSymbol()}
                  </span>
                </div>
                <div className="dimension-card" style={{ gridColumn: 'span 2' }}>
                  <span className="dimension-label">Orientation Axis</span>
                  <span className="dimension-value" style={{ textTransform: 'uppercase' }}>
                    {modelMetrics.cylinderDimensions.axis} axis
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Custom click-to-measure list */}
      <div className="sidebar-section">
        <h3 className="sidebar-title">
          <Award size={16} /> Measurement History ({measurements.length})
        </h3>
        
        {measurements.length === 0 ? (
          <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
            No measurements recorded yet. Enable the tape tool to measure 3D points.
          </p>
        ) : (
          <div>
            <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '10px' }}>
              {measurements.map((m, idx) => (
                <div key={m.id} className="measure-history-item">
                  <span>M{idx + 1}: <strong>
                    {unit === 'in' ? `${(m.distance / 25.4).toFixed(3)}"` : `${m.distance.toFixed(1)} mm`}
                  </strong></span>
                  <button 
                    className="measure-history-delete"
                    onClick={() => removeMeasurement(m.id)}
                    title="Delete measurement"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <button 
              className="action-btn"
              style={{ width: '100%', justifyContent: 'center', borderColor: '#f87171', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}
              onClick={clearMeasurements}
            >
              Clear All Tape Points
            </button>
          </div>
        )}
      </div>

      {/* 6. AI Manufacturing Reasoning Panel */}
      <div className="sidebar-section" style={{ borderBottom: 'none' }}>
        <h3 className="sidebar-title">
          <Cpu size={16} /> Manufacturing Suggestions
        </h3>
        
        {insights.length === 0 ? (
          <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
            Load a model to view automated manufacturing advice.
          </p>
        ) : (
          insights.map((ins, idx) => (
            <div key={idx} className="recommendation-card" style={{
              borderLeftColor: ins.type === 'success' ? '#10b981' : ins.type === 'warning' ? '#f59e0b' : '#6366f1'
            }}>
              <div className="recommendation-header">
                <span className={`badge-green font-medium text-[10px] px-2 py-0.5 rounded-full ${
                  ins.type === 'success' ? 'badge-green' : ins.type === 'warning' ? 'badge-yellow' : 'badge-blue'
                }`} style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '9px',
                  fontWeight: 600,
                }}>
                  {ins.badge}
                </span>
                <span style={{ fontWeight: 600 }}>{ins.title}</span>
              </div>
              <div className="recommendation-body" style={{ marginTop: '4px' }}>
                {ins.body}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
