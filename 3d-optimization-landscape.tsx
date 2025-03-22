import React, { useState, useEffect } from 'react';
import { Play, Pause, RefreshCw, RotateCw } from 'lucide-react';
import * as d3 from 'd3';

const ThreeDOptimizationLandscape = () => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const [rotationAngle, setRotationAngle] = useState(30);
  const [elevationAngle, setElevationAngle] = useState(30);
  const [showUncertainty, setShowUncertainty] = useState(false);
  
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setTime(prevTime => (prevTime + 1) % 100);
      }, 150);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const width = 600;
  const height = 500;
  const margin = { top: 20, right: 20, bottom: 40, left: 40 };
  
  // 3D projection parameters
  const scale = 40;
  const distance = 10;
  
  // Function to project 3D points to 2D
  const project = (x, y, z) => {
    const angle = (rotationAngle * Math.PI) / 180;
    const elevation = (elevationAngle * Math.PI) / 180;
    
    // Rotate around y-axis first
    const rotX = x * Math.cos(angle) - z * Math.sin(angle);
    const rotZ = x * Math.sin(angle) + z * Math.cos(angle);
    
    // Then rotate for elevation
    const finalY = y * Math.cos(elevation) - rotZ * Math.sin(elevation);
    const finalZ = y * Math.sin(elevation) + rotZ * Math.cos(elevation);
    
    // Project to 2D
    const perspective = distance / (distance + finalZ);
    
    return {
      x: width/2 + rotX * scale * perspective,
      y: height/2 - finalY * scale * perspective,
      z: finalZ,
      perspective
    };
  };

  // Generate surface data
  const generateSurface = () => {
    const gridSize = 20;
    const points = [];
    
    // Moving global maximum position
    const globalMaxX = 3 + Math.sin(time * 0.1);
    const globalMaxY = 3 + Math.cos(time * 0.15);
    
    // Fixed local maximum (plateau region)
    const localMaxX = 0;
    const localMaxY = 0;
    
    for (let i = -5; i <= 5; i += 10/gridSize) {
      for (let j = -5; j <= 5; j += 10/gridSize) {
        // Calculate height based on distance from two maxima
        const distToGlobal = Math.sqrt(Math.pow(i - globalMaxX, 2) + Math.pow(j - globalMaxY, 2));
        const globalPeak = Math.exp(-distToGlobal * 0.7) * 5;
        
        // Plateau function is flatter
        const distToLocal = Math.sqrt(Math.pow(i - localMaxX, 2) + Math.pow(j - localMaxY, 2));
        const localPeak = Math.exp(-distToLocal * 0.3) * 3;
        
        // Combined height function with some noise
        const height = Math.max(globalPeak, localPeak) + (Math.random() * 0.1);
        
        points.push({
          x: i,
          y: j,
          z: height,
          type: globalPeak > localPeak ? 'global' : 'local'
        });
      }
    }
    
    return { 
      points,
      globalMax: { x: globalMaxX, y: globalMaxY, z: 5 },
      localMax: { x: localMaxX, y: localMaxY, z: 3 }
    };
  };
  
  const surfaceData = generateSurface();
  
  // Sort points by z for proper rendering (back-to-front)
  const sortedPoints = [...surfaceData.points].sort((a, b) => {
    const projA = project(a.x, a.z, a.y);
    const projB = project(b.x, b.z, b.y);
    return projB.z - projA.z;
  });
  
  // Generate grid lines
  const generateGridLines = () => {
    const lines = [];
    
    // X constant lines
    for (let i = -5; i <= 5; i += 1) {
      const linePoints = [];
      for (let j = -5; j <= 5; j += 0.2) {
        // Find the corresponding Z value by interpolating from surface
        let z = 0;
        for (const point of surfaceData.points) {
          if (Math.abs(point.x - i) < 0.3 && Math.abs(point.y - j) < 0.3) {
            z = point.z;
            break;
          }
        }
        linePoints.push(project(i, z, j));
      }
      lines.push(linePoints);
    }
    
    // Y constant lines
    for (let j = -5; j <= 5; j += 1) {
      const linePoints = [];
      for (let i = -5; i <= 5; i += 0.2) {
        let z = 0;
        for (const point of surfaceData.points) {
          if (Math.abs(point.x - i) < 0.3 && Math.abs(point.y - j) < 0.3) {
            z = point.z;
            break;
          }
        }
        linePoints.push(project(i, z, j));
      }
      lines.push(linePoints);
    }
    
    return lines;
  };
  
  const gridLines = generateGridLines();
  
  // Optimization path animation
  const generateOptimizationPath = () => {
    const steps = Math.min(20, time + 1);
    const path = [];
    
    // Starting point
    const startX = -4;
    const startY = -4;
    const startZ = 0.1;
    
    // Target is the local maximum
    const targetX = surfaceData.localMax.x;
    const targetY = surfaceData.localMax.y;
    
    // Add noise to make it look more realistic
    const noiseAmplitude = 0.4;
    
    for (let i = 0; i <= steps; i++) {
      const t = i / 20;
      
      // Linear interpolation with some noise
      const x = startX + (targetX - startX) * t + (Math.random() - 0.5) * noiseAmplitude * t;
      const y = startY + (targetY - startY) * t + (Math.random() - 0.5) * noiseAmplitude * t;
      
      // Find z-value from surface
      let z = 0;
      for (const point of surfaceData.points) {
        if (Math.abs(point.x - x) < 0.3 && Math.abs(point.y - y) < 0.3) {
          z = point.z;
          break;
        }
      }
      
      path.push({ x, y, z });
    }
    
    return path;
  };
  
  const optimizationPath = generateOptimizationPath();
  
  // Generate uncertainty cloud around local maximum
  const generateUncertaintyCloud = () => {
    if (!showUncertainty) return [];
    
    const cloudPoints = [];
    const center = surfaceData.localMax;
    const pointCount = 40;
    
    for (let i = 0; i < pointCount; i++) {
      // Random points in an ellipsoid around the local maximum
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      
      // Ellipsoid parameters - wider in parameter space, narrower in z
      const a = 1.5; // X radius
      const b = 1.5; // Y radius
      const c = 0.2; // Z radius
      
      const x = center.x + a * Math.sin(phi) * Math.cos(theta);
      const y = center.y + b * Math.sin(phi) * Math.sin(theta);
      
      // Z is close to the surface value but with small variation
      let surfaceZ = 0;
      for (const point of surfaceData.points) {
        if (Math.abs(point.x - x) < 0.3 && Math.abs(point.y - y) < 0.3) {
          surfaceZ = point.z;
          break;
        }
      }
      
      const z = center.z - 0.1 + c * Math.cos(phi) * (Math.random() * 0.8);
      
      cloudPoints.push({ x, y, z });
    }
    
    return cloudPoints;
  };
  
  const uncertaintyCloud = generateUncertaintyCloud();
  
  // Project key points
  const projectedGlobalMax = project(
    surfaceData.globalMax.x, 
    surfaceData.globalMax.z,
    surfaceData.globalMax.y
  );
  
  const projectedLocalMax = project(
    surfaceData.localMax.x, 
    surfaceData.localMax.z,
    surfaceData.localMax.y
  );
  
  // Color scale for height
  const colorScale = d3.scaleSequential(d3.interpolateViridis)
    .domain([0, 5]);
    
  return (
    <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
      <h2 className="text-xl font-bold mb-4">3D Parameter Space Optimization Landscape</h2>
      
      <div className="relative">
        <svg width={width} height={height} className="border border-gray-300 bg-white">
          {/* Draw axes */}
          <line 
            x1={project(-5, 0, -5).x} 
            y1={project(-5, 0, -5).y} 
            x2={project(5, 0, -5).x} 
            y2={project(5, 0, -5).y} 
            stroke="black" 
            strokeWidth="2" 
          />
          <line 
            x1={project(-5, 0, -5).x} 
            y1={project(-5, 0, -5).y} 
            x2={project(-5, 0, 5).x} 
            y2={project(-5, 0, 5).y} 
            stroke="black" 
            strokeWidth="2" 
          />
          <line 
            x1={project(-5, 0, -5).x} 
            y1={project(-5, 0, -5).y} 
            x2={project(-5, 5, -5).x} 
            y2={project(-5, 5, -5).y} 
            stroke="black" 
            strokeWidth="2" 
          />
          
          {/* Axis labels */}
          <text 
            x={(project(5, 0, -5).x + project(-5, 0, -5).x) / 2} 
            y={project(0, 0, -5).y + 30} 
            textAnchor="middle"
            className="text-sm font-medium"
          >
            Parameter Space
          </text>
          <text 
            x={project(-5, 5, -5).x - 15} 
            y={project(-5, 5, -5).y} 
            textAnchor="middle"
            className="text-sm font-medium"
          >
            Log-Likelihood
          </text>
          
          {/* Grid lines */}
          {gridLines.map((line, i) => (
            <polyline 
              key={`grid-${i}`}
              points={line.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#aaa"
              strokeWidth="0.5"
              strokeOpacity="0.4"
            />
          ))}
          
          {/* Surface points */}
          {sortedPoints.map((point, i) => {
            const proj = project(point.x, point.z, point.y);
            return (
              <circle 
                key={`point-${i}`}
                cx={proj.x}
                cy={proj.y}
                r={2.5 * proj.perspective}
                fill={colorScale(point.z)}
                opacity={0.8}
              />
            );
          })}
          
          {/* Optimization path */}
          <polyline 
            points={optimizationPath.map(p => {
              const proj = project(p.x, p.z, p.y);
              return `${proj.x},${proj.y}`;
            }).join(' ')}
            fill="none"
            stroke="red"
            strokeWidth="3"
            strokeDasharray="5,5"
          />
          
          {/* Draw uncertainty cloud around local maximum */}
          {uncertaintyCloud.map((point, i) => {
            const proj = project(point.x, point.z, point.y);
            return (
              <circle 
                key={`uncertainty-${i}`}
                cx={proj.x}
                cy={proj.y}
                r={3 * proj.perspective}
                fill="red"
                opacity={0.3}
              />
            );
          })}
          
          {/* Global maximum */}
          <circle 
            cx={projectedGlobalMax.x}
            cy={projectedGlobalMax.y}
            r={8 * projectedGlobalMax.perspective}
            fill="green"
          />
          
          {/* Local maximum */}
          <circle 
            cx={projectedLocalMax.x}
            cy={projectedLocalMax.y}
            r={8 * projectedLocalMax.perspective}
            fill="red"
          />
          
          {/* Vertical line from global maximum to base */}
          <line 
            x1={projectedGlobalMax.x}
            y1={projectedGlobalMax.y}
            x2={project(surfaceData.globalMax.x, 0, surfaceData.globalMax.y).x}
            y2={project(surfaceData.globalMax.x, 0, surfaceData.globalMax.y).y}
            stroke="green"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          
          {/* Vertical line from local maximum to base */}
          <line 
            x1={projectedLocalMax.x}
            y1={projectedLocalMax.y}
            x2={project(surfaceData.localMax.x, 0, surfaceData.localMax.y).x}
            y2={project(surfaceData.localMax.x, 0, surfaceData.localMax.y).y}
            stroke="red"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          
          {/* Legend */}
          <rect x={width - 180} y="20" width="160" height="130" fill="white" stroke="gray" />
          <circle cx={width - 160} cy="45" r="6" fill="red" />
          <text x={width - 145} y="48" className="text-sm">Local Maximum (Plateau)</text>
          <circle cx={width - 160} cy="70" r="6" fill="green" />
          <text x={width - 145} y="73" className="text-sm">Global Maximum (Moving)</text>
          <line x1={width - 170} y1="95" x2={width - 150} y2="95" stroke="red" strokeWidth="3" strokeDasharray="5,5" />
          <text x={width - 145} y="98" className="text-sm">Optimization Path</text>
          <circle cx={width - 160} cy="120" r="6" fill="red" opacity="0.3" />
          <text x={width - 145} y="123" className="text-sm">Parameter Uncertainty</text>
        </svg>
      </div>
      
      <div className="flex mt-4 space-x-4">
        <button 
          className="px-4 py-2 bg-blue-500 text-white rounded flex items-center"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? <Pause className="mr-2" size={16} /> : <Play className="mr-2" size={16} />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        
        <button 
          className="px-4 py-2 bg-green-500 text-white rounded flex items-center"
          onClick={() => setShowUncertainty(!showUncertainty)}
        >
          {showUncertainty ? 'Hide' : 'Show'} Uncertainty
        </button>
        
        <button 
          className="px-4 py-2 bg-purple-500 text-white rounded flex items-center"
          onClick={() => setRotationAngle((rotationAngle + 10) % 360)}
        >
          <RotateCw className="mr-2" size={16} />
          Rotate View
        </button>
        
        <button 
          className="px-4 py-2 bg-gray-500 text-white rounded flex items-center"
          onClick={() => {
            setTime(0);
            setRotationAngle(30);
            setElevationAngle(30);
          }}
        >
          <RefreshCw className="mr-2" size={16} />
          Reset
        </button>
      </div>
      
      <div className="mt-6 p-4 bg-white border border-gray-300 rounded w-full">
        <h3 className="font-bold">What This 3D Visualization Demonstrates:</h3>
        <ul className="list-disc pl-6 mt-2">
          <li>The horizontal plane represents a multi-dimensional parameter space (potentially many parameters)</li>
          <li>The <span className="text-red-500">red plateau region</span> shows where many parameter combinations yield similar likelihood values</li>
          <li>The <span className="text-green-500">green peak</span> represents the true global maximum, which moves over time</li>
          <li>The optimization algorithm (red dashed line) typically converges to the plateau region rather than finding the global maximum</li>
          <li>Click "Show Uncertainty" to visualize high standard errors in parameter estimates within the plateau region</li>
          <li>The plateau causes parameter estimation bias because multiple parameter combinations produce nearly identical model fits</li>
          <li>In real-world problems with many parameters, these plateaus become higher-dimensional and harder to navigate</li>
        </ul>
      </div>
    </div>
  );
};

export default ThreeDOptimizationLandscape;
