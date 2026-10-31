import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { sound } from '../utils/audio';

export type TrafficScenario = 'normal' | 'rush_hour' | 'incident' | 'weather';

export const TrafficMapCanvas: React.FC = () => {
  const { currentClients, currentRound, maxRounds, isPlaying, addToast } = useApp();
  const [selectedNode, setSelectedNode] = useState<string | null>('INT-01');
  const [activeScenario, setActiveScenario] = useState<TrafficScenario>('normal');
  const [animTime, setAnimTime] = useState<number>(0);

  // Animation ticker for moving vehicles and uplink pulses
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimTime((prev) => (prev + 1) % 100);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  const nodes = [
    {
      id: 'INT-01',
      name: 'Downtown Arterial',
      x: 180,
      y: 120,
      baseSpeed: 42,
      baseFlow: 1420,
      queue: 18,
      status: 'Normal',
      color: '#006398',
    },
    {
      id: 'INT-02',
      name: 'Expressway Ramp 4A',
      x: 420,
      y: 90,
      baseSpeed: activeScenario === 'incident' ? 14 : 58,
      baseFlow: activeScenario === 'incident' ? 620 : 1850,
      queue: activeScenario === 'incident' ? 78 : 12,
      status: activeScenario === 'incident' ? 'Incident Alert' : 'Fluid',
      color: activeScenario === 'incident' ? '#ba1a1a' : '#009668',
    },
    {
      id: 'INT-03',
      name: 'Commercial Center',
      x: 640,
      y: 160,
      baseSpeed: activeScenario === 'rush_hour' ? 22 : 36,
      baseFlow: activeScenario === 'rush_hour' ? 2100 : 1290,
      queue: activeScenario === 'rush_hour' ? 52 : 24,
      status: activeScenario === 'rush_hour' ? 'Heavy Congestion' : 'Moderate',
      color: activeScenario === 'rush_hour' ? '#d97706' : '#006398',
    },
    {
      id: 'INT-04',
      name: 'Suburban Feeder',
      x: 260,
      y: 280,
      baseSpeed: activeScenario === 'weather' ? 28 : 46,
      baseFlow: 940,
      queue: activeScenario === 'weather' ? 34 : 14,
      status: activeScenario === 'weather' ? 'Wet Roadways' : 'Optimal',
      color: activeScenario === 'weather' ? '#6b21a8' : '#009668',
    },
    {
      id: 'INT-05',
      name: 'University Junction',
      x: 520,
      y: 290,
      baseSpeed: 32,
      baseFlow: 890,
      queue: 20,
      status: 'Pedestrian Crossing',
      color: '#006398',
    },
  ];

  const handleScenarioChange = (scenario: TrafficScenario) => {
    sound.playAlert();
    setActiveScenario(scenario);
    const messages: Record<TrafficScenario, string> = {
      normal: 'Normal baseline traffic patterns restored across all 5 corridors.',
      rush_hour: 'Simulating Morning Commuter Surge (+45% volume, queue build-up).',
      incident: 'Simulating Roadway Incident at INT-02 (Right lane blockage, speed drops to 14 mph).',
      weather: 'Simulating Severe Rainstorm (Surface friction reduced, speeds capped across grid).',
    };
    addToast('Scenario Activated', messages[scenario], scenario === 'normal' ? 'info' : 'warning');
  };

  const selectedNodeData = nodes.find((n) => n.id === selectedNode) || nodes[0];

  return (
    <div className="bg-surface-container-lowest p-space-md sm:p-space-lg rounded-2xl shadow-sm border border-surface-container/70 flex flex-col gap-space-md">
      {/* Header & Scenario Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-xs border-b border-surface-container">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">alt_route</span>
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
              Roadside Topology (Illustrative Animation)
            </h3>
            <span className="inline-block mt-1 font-label-sm text-label-sm px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-800 font-bold">
              Illustration only: intersection names, speeds, flows and queues on this map are not measured data
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Interactive spatial map of 5 virtual RSUs with real-time telemetry streaming and anomaly injection
          </p>
        </div>

        {/* Anomaly Scenarios Bar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-on-surface-variant mr-1">Inject:</span>
          <button
            onClick={() => handleScenarioChange('normal')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeScenario === 'normal'
                ? 'bg-secondary text-on-secondary shadow-xs'
                : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
            }`}
          >
            Normal
          </button>
          <button
            onClick={() => handleScenarioChange('rush_hour')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              activeScenario === 'rush_hour'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
            }`}
          >
            <span>Surge</span>
          </button>
          <button
            onClick={() => handleScenarioChange('incident')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              activeScenario === 'incident'
                ? 'bg-error text-white shadow-xs'
                : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
            }`}
          >
            <span>Incident</span>
          </button>
          <button
            onClick={() => handleScenarioChange('weather')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              activeScenario === 'weather'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
            }`}
          >
            <span>Rain</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas & Node Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-center">
        {/* Interactive SVG Road Canvas */}
        <div className="lg:col-span-8 bg-surface-container-low rounded-xl border border-surface-container p-2 relative overflow-hidden flex items-center justify-center min-h-[340px]">
          <svg viewBox="0 0 800 380" className="w-full h-auto select-none max-h-[380px]">
            {/* Background Grid Pattern */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-surface-container-high" />
              </pattern>
              {/* Pulsing Gradient Marker for Aggregator Server */}
              <radialGradient id="serverGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#006398" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#006398" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="800" height="380" fill="url(#grid)" />

            {/* Central FedAvg Aggregation Server in Center */}
            <g transform="translate(380, 200)">
              <circle r="44" fill="url(#serverGlow)" className="animate-pulse" />
              <rect x="-24" y="-24" width="48" height="48" rx="10" fill="#0b1c30" stroke="#006398" strokeWidth="2.5" />
              <text x="0" y="3" textAnchor="middle" fill="#ffffff" fontSize="18" fontFamily="Material Symbols Outlined">
                cloud
              </text>
              <text x="0" y="38" textAnchor="middle" fill="#0b1c30" fontSize="10" fontWeight="bold">
                FedAvg Hub
              </text>
              <text x="0" y="49" textAnchor="middle" fill="#006398" fontSize="8" fontFamily="monospace">
                R-{currentRound}/{maxRounds}
              </text>
            </g>

            {/* Arterial Corridors (Roadways) */}
            {/* Main West-East Arterial Highway */}
            <line x1="80" y1="120" x2="720" y2="120" stroke="#c6c6cd" strokeWidth="28" strokeLinecap="round" />
            <line x1="80" y1="120" x2="720" y2="120" stroke="#ffffff" strokeWidth="2" strokeDasharray="12,12" />

            {/* Diagonal Connector */}
            <line x1="180" y1="120" x2="260" y2="280" stroke="#c6c6cd" strokeWidth="22" strokeLinecap="round" />
            <line x1="420" y1="90" x2="520" y2="290" stroke="#c6c6cd" strokeWidth="22" strokeLinecap="round" />
            <line x1="260" y1="280" x2="680" y2="280" stroke="#c6c6cd" strokeWidth="24" strokeLinecap="round" />
            <line x1="260" y1="280" x2="680" y2="280" stroke="#ffffff" strokeWidth="2" strokeDasharray="10,10" />

            {/* Wireless Uplink Transmission Waves from Nodes to Hub */}
            {nodes.map((node) => {
              const pulsePos = (animTime * 0.01 + parseInt(node.id.slice(-1)) * 0.2) % 1;
              const px = node.x + (380 - node.x) * pulsePos;
              const py = node.y + (200 - node.y) * pulsePos;
              return (
                <g key={`wire-${node.id}`}>
                  <line
                    x1={node.x}
                    y1={node.y}
                    x2="380"
                    y2="200"
                    stroke="#006398"
                    strokeWidth="1.2"
                    strokeDasharray="4,4"
                    opacity="0.35"
                  />
                  {isPlaying && (
                    <circle cx={px} cy={py} r="3" fill="#009668" opacity="0.9" />
                  )}
                </g>
              );
            })}

            {/* Moving Vehicles on Roadways */}
            {nodes.map((node, i) => {
              const carPos1 = ((animTime * 1.5 + i * 25) % 100) / 100;
              const carX = 100 + carPos1 * 600;
              return (
                <rect
                  key={`car-${i}`}
                  x={carX}
                  y="116"
                  width="10"
                  height="7"
                  rx="2"
                  fill={i === 1 && activeScenario === 'incident' ? '#ba1a1a' : '#45464d'}
                />
              );
            })}

            {/* Roadside Units (RSU Nodes) */}
            {nodes.map((node) => {
              const isSelected = selectedNode === node.id;
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer group"
                  onClick={() => {
                    sound.playTick();
                    setSelectedNode(node.id);
                  }}
                >
                  {/* Selection Ring */}
                  {isSelected && (
                    <circle r="26" fill="none" stroke={node.color} strokeWidth="2" strokeDasharray="4,3" className="animate-spin" style={{ animationDuration: '6s' }} />
                  )}
                  {/* Outer Shield */}
                  <circle r="18" fill="#ffffff" stroke={node.color} strokeWidth="2.5" className="shadow-md transition-transform group-hover:scale-110" />
                  {/* Icon */}
                  <text x="0" y="5" textAnchor="middle" fill={node.color} fontSize="14" fontFamily="Material Symbols Outlined">
                    router
                  </text>
                  {/* Label */}
                  <rect x="-24" y="22" width="48" height="15" rx="4" fill="#0b1c30" />
                  <text x="0" y="33" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace">
                    {node.id}
                  </text>
                  {/* Status Indicator */}
                  <circle cx="14" cy="-14" r="4.5" fill={node.color} stroke="#ffffff" strokeWidth="1.5" />
                </g>
              );
            })}
          </svg>

          {/* Quick Map Legend Overlay */}
          <div className="absolute bottom-2 left-2 bg-surface-container-lowest/90 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-surface-container text-[10px] text-on-surface-variant flex items-center gap-3">
            <span className="flex items-center gap-1 font-semibold text-on-surface">
              <span className="w-2 h-2 rounded-full bg-secondary"></span> 5G/4G Edge RSU
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-on-tertiary-container"></span> Gradient Uplink
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-error"></span> Incident/Surge
            </span>
          </div>
        </div>

        {/* Selected Node Real-Time Telemetry Inspector Card */}
        <div className="lg:col-span-4 bg-surface-container-low rounded-xl p-space-md border border-surface-container flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-surface-container">
              <div>
                <span className="font-mono text-xs font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded">
                  {selectedNodeData.id}
                </span>
                <h4 className="font-headline-sm text-sm font-bold text-on-surface mt-1">
                  {selectedNodeData.name}
                </h4>
              </div>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${selectedNodeData.color}20`,
                  color: selectedNodeData.color,
                }}
              >
                {selectedNodeData.status}
              </span>
            </div>

            {/* Telemetry Stat Gauges */}
            <div className="grid grid-cols-2 gap-2.5 my-3">
              <div className="p-2.5 bg-surface-container rounded-lg">
                <span className="text-[10px] text-on-surface-variant uppercase font-medium">Flow Rate</span>
                <div className="text-base font-bold font-mono text-on-surface mt-0.5">
                  {selectedNodeData.baseFlow} <span className="text-[10px] font-normal text-on-surface-variant">veh/h</span>
                </div>
              </div>
              <div className="p-2.5 bg-surface-container rounded-lg">
                <span className="text-[10px] text-on-surface-variant uppercase font-medium">Corridor Speed</span>
                <div className="text-base font-bold font-mono text-secondary mt-0.5">
                  {selectedNodeData.baseSpeed} <span className="text-[10px] font-normal text-on-surface-variant">mph</span>
                </div>
              </div>
              <div className="p-2.5 bg-surface-container rounded-lg">
                <span className="text-[10px] text-on-surface-variant uppercase font-medium">Signal Queue</span>
                <div className="text-base font-bold font-mono text-on-surface mt-0.5">
                  {selectedNodeData.queue} <span className="text-[10px] font-normal text-on-surface-variant">vehicles</span>
                </div>
              </div>
              <div className="p-2.5 bg-surface-container rounded-lg">
                <span className="text-[10px] text-on-surface-variant uppercase font-medium">Uplink Budget</span>
                <div className="text-base font-bold font-mono text-on-tertiary-container mt-0.5">
                  58.24 <span className="text-[10px] font-normal text-on-surface-variant">KB/rnd</span>
                </div>
              </div>
            </div>

            {/* Edge Hardware Profile */}
            <div className="text-[11px] text-on-surface-variant space-y-1.5 pt-1">
              <div className="flex justify-between">
                <span>Processor:</span>
                <span className="font-mono text-on-surface">ARM Cortex-A72 (Quad-Core)</span>
              </div>
              <div className="flex justify-between">
                <span>Local Buffer:</span>
                <span className="font-mono text-on-surface">43,200 time-steps (PeMS04)</span>
              </div>
              <div className="flex justify-between">
                <span>Cellular Signal (RSSI):</span>
                <span className="font-mono text-on-tertiary-container font-semibold">-68 dBm (Excellent)</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playSuccess();
              addToast(`Node ${selectedNodeData.id} Synced`, 'Local model gradient tensors verified against central parameter server.', 'success');
            }}
            className="w-full py-2 bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-surface-container-high"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">sync</span>
            <span>Verify Edge Weight Checksum</span>
          </button>
        </div>
      </div>
    </div>
  );
};

