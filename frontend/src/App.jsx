import React, { useState, useEffect } from 'react';

const API_BASE_URL = '/api';

export default function App() {
  // Simulate authentication profile tokens locally
  const [currentUser, setCurrentUser] = useState({
    id: 'user_1',
    name: 'Agent Alice',
    tenantId: 'tenant_a',
    tenantName: 'Tenant A Recovery Corp'
  });

  // Application UI States
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [locationTrail, setLocationTrail] = useState([]);
  const [loading, setLoading] = useState(false);
  const [trailLoading, setTrailLoading] = useState(false);
  
  // Interactive Camera Trigger Webhook Form States
  const [cameraId, setCameraId] = useState('cam_1001');
  const [scanVin, setScanVin] = useState('1FTFW1E51NFA12345');
  const [scanPlate, setScanPlate] = useState('7XYZ123');

  // Toggle identity context profiles to showcase strict multi-tenant boundaries
  const switchTenant = (tenantKey) => {
    setSelectedCase(null);
    setLocationTrail([]);
    if (tenantKey === 'tenant_a') {
      setCurrentUser({ id: 'user_1', name: 'Agent Alice', tenantId: 'tenant_a', tenantName: 'Tenant A Recovery Corp' });
      setCameraId('cam_1001');
    } else {
      setCurrentUser({ id: 'user_2', name: 'Agent Bob', tenantId: 'tenant_b', tenantName: 'Tenant B Repossession Experts' });
      setCameraId('cam_2050');
    }
  };

  // Build secure request headers injected with current operational tenant state
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'x-tenant-id': currentUser.tenantId,
    'x-user-id': currentUser.id
  });

  // FLOW EXEC 1: Query endpoint for tenant-accessible cases (Own active/closed + all pending_claims)
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/v1/cases`, { headers: getHeaders() });
      if (!res.ok) throw new Error("Security boundary verification check failed.");
      const data = await res.json();
      setCases(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // FLOW EXEC 2: Load historical geospatial tracking path trails for a specific case
  const loadCaseTrail = async (caseObj) => {
    setSelectedCase(caseObj);
    setTrailLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/v1/cases/${caseObj.id}/scans`, { headers: getHeaders() });
      if (!res.ok) throw new Error("Failed to load historical sensor telemetry logs.");
      const data = await res.json();
      setLocationTrail(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setTrailLoading(false);
    }
  };

  // FLOW EXEC 3: Mutate cross-tenant case status (Claim an open pending_claim asset)
  const handleClaim = async (caseId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/cases/${caseId}/claim`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (!res.ok) throw new Error("Target assignment claim request rejected by server.");
      alert("Success! Vehicle tracking case claimed and transferred to your agency directory.");
      fetchDashboardData();
    } catch (err) {
      alert(err.message);
    }
  };

  // CAMERA SIMULATOR: Fire a test camera scan webhook to the unauthenticated ingestion API
  const handleSimulatedScanTrigger = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        camera_id: cameraId,
        plate: scanPlate,
        vin: scanVin,
        latitude: 33.7490 + (Math.random() - 0.5) * 0.05,
        longitude: -84.3880 + (Math.random() - 0.5) * 0.05,
        scanned_at: new Date().toISOString(),
        image_url: "https://unsplash.com"
      };

      const res = await fetch(`${API_BASE_URL}/v1/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const log = await res.json();
      alert(`Camera Scan Ingested Successfully!\n\nFlow Routed: ${log.flow}\nResult: ${log.detail}`);
      
      // Auto-refresh layout logs
      fetchDashboardData();
      if (selectedCase && selectedCase.vin === scanVin) {
        loadCaseTrail(selectedCase);
      }
    } catch (err) {
      alert(`Ingestion Error: ${err.message}\nMake sure your Python server is running on port 8000!`);
    }
  };

  // SEED TRIGGER: Wipe and hydrate the database with the case study mock fixtures
  const handleHydrateSeed = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/seed`, { method: 'POST' });
      if (res.ok) {
        alert("SQL database state refreshed to initial conditions successfully!");
        fetchDashboardData();
      }
    } catch (err) {
      alert("Hydration server unreachable. Ensure backend is live.");
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currentUser.tenantId]);

  // Client-side partitioning for rendering panels cleanly
  const activeOwnedCases = cases.filter(c => c.tenant_id === currentUser.tenantId);
  const marketplacePendingClaims = cases.filter(c => c.status === 'pending_claim');

  return (
     <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col antialiased">
      {/* Premium Top Bar Navigation Controls */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap justify-between items-center shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-indigo-600">LPR Control and Vehicle Recovery Hub</h1>
          <p className="text-xs text-slate-500 mt-1">
            Active Operator: <span className="font-semibold text-slate-700">{currentUser.name}</span> | Agency Workspace Scope: <span className="text-indigo-500 font-semibold">{currentUser.tenantName}</span>
          </p>
        </div>
        <div className="flex gap-3 items-center mt-3 sm:mt-0">
          <button onClick={handleHydrateSeed} className="bg-white text-slate-700 text-xs px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition font-medium">
            Reset DB Seed Data
          </button>
          <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex text-xs">
            <button onClick={() => switchTenant('tenant_a')} className={`px-4 py-1.5 rounded-md transition font-semibold ${currentUser.tenantId === 'tenant_a' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              Tenant A
            </button>
            <button onClick={() => switchTenant('tenant_b')} className={`px-4 py-1.5 rounded-md transition font-semibold ${currentUser.tenantId === 'tenant_b' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              Tenant B
            </button>
          </div>
        </div>
      </header>

      {/* Tri-Panel Interactive Workspace Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 p-6 gap-6">
        
        {/* PANEL 1: Telemetry Camera Simulator */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-4 text-indigo-600">Truck Camera Webhook</h2>
            <form onSubmit={handleSimulatedScanTrigger} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 mb-1 font-semibold">Resolved Camera Asset</label>
                <input type="text" value={cameraId} readOnly className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-400 font-mono focus:outline-none" />
              </div>
              <div>
                <label className="block text-slate-500 mb-1 font-semibold">Scan Vehicle VIN</label>
                <input type="text" value={scanVin} onChange={(e) => setScanVin(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-mono tracking-wide shadow-inner" />
              </div>
              <div>
                <label className="block text-slate-500 mb-1 font-semibold">Observed License Plate</label>
                <input type="text" value={scanPlate} onChange={(e) => setScanPlate(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 uppercase font-semibold shadow-inner" />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-lg shadow-md hover:bg-indigo-500 transition mt-2">
                Simulate Inbound Plate Hit
              </button>
            </form>
            <div className="mt-4 text-[11px] text-slate-500 border-t border-slate-100 pt-3 leading-relaxed">
              New Flow Hint: Scanning a new random VIN creates a shared pending_claim case if eligible. Ending in 999 mimics repo-ineligibility.
            </div>
          </div>
        </div>
        {/* PANEL 2: Case Files Indexes */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Section A: Internal Agency Secure Trackers */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 max-h-[340px]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">Owned Agency Case Files</h2>
              <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-600 font-bold px-2 py-0.5 rounded-full">{activeOwnedCases.length} Active</span>
            </div>
            <div className="p-2 overflow-y-auto flex-1 space-y-1">
              {loading ? (
                <p className="text-xs italic text-slate-400 p-4">Syncing client registers...</p>
              ) : activeOwnedCases.length === 0 ? (
                <p className="text-xs italic text-slate-400 p-4">No recovery targets registered to this tenant profile scope.</p>
              ) : (
                activeOwnedCases.map(c => (
                  <div key={c.id} onClick={() => loadCaseTrail(c)} className={`p-3 rounded-lg border cursor-pointer transition text-xs flex justify-between items-center ${selectedCase?.id === c.id ? 'bg-indigo-50/50 border-indigo-500' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                    <div>
                      <p className="font-mono text-slate-700 font-semibold tracking-tight">{c.vin}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Plate Ref: <span className="text-slate-600 font-medium">{c.plate || 'N/A'}</span></p>
                    </div>
                    <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section B: Shared Global Pending Pool */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 max-h-[340px]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">Unassigned Global Pending Pool</h2>
              <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 font-bold px-2 py-0.5 rounded-full">{marketplacePendingClaims.length} Open</span>
            </div>
            <div className="p-2 overflow-y-auto flex-1 space-y-1">
              {loading ? (
                <p className="text-xs italic text-slate-400 p-4">Loading data clearinghouse logs...</p>
              ) : marketplacePendingClaims.length === 0 ? (
                <p className="text-xs italic text-slate-400 p-4">No unallocated repo files currently pending claim matching indexes.</p>
              ) : (
                marketplacePendingClaims.map(c => (
                  <div key={c.id} className="p-3 bg-white border border-slate-100 rounded-lg text-xs flex justify-between items-center hover:border-slate-200 transition">
                    <div>
                      <p className="font-mono text-slate-700 font-semibold">{c.vin}</p>
                      <p className="text-[11px] text-amber-600 font-medium mt-0.5">Eligibility Verified • Open to Claim</p>
                    </div>
                    <button onClick={() => handleClaim(c.id)} className="bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] hover:bg-indigo-500 transition shadow-sm">
                      Claim Case
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* PANEL 3: Geospatial Sighting History Timeline Trail */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[500px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">Geospatial Sighting Trail Intelligence</h2>
          </div>
          <div className="flex-1 p-4 overflow-y-auto max-h-[600px] custom-scroll">
            {selectedCase ? (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Investigation Target</p>
                  <p className="text-xs font-mono text-indigo-600 font-bold mt-0.5 tracking-tight break-all">{selectedCase.vin}</p>
                </div>

                {trailLoading ? (
                  <p className="text-xs italic text-slate-400">Querying location tracking coordinates...</p>
                ) : locationTrail.length === 0 ? (
                  <p className="text-xs italic text-slate-400 text-center py-6">No historical scanning data logged for this vehicle code matching index.</p>
                ) : (
                  <div className="relative border-l-2 border-slate-200 pl-4 space-y-4 ml-2">
                    {locationTrail.map((scan) => (
                      <div key={scan.id} className="relative group">
                        <div className="absolute -left-[21px] top-1.5 bg-indigo-600 w-2.5 h-2.5 rounded-full ring-4 ring-white group-hover:bg-indigo-500 transition" />
                        
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs space-y-1 hover:border-slate-200 transition">
                          <div className="flex justify-between items-center text-slate-400 text-[10px] mb-1">
                            <span className="font-semibold text-slate-600">{new Date(scan.scanned_at).toLocaleString()}</span>
                            <span className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-600 text-[9px] font-bold uppercase tracking-wide">Camera: {scan.camera_id}</span>
                          </div>
                          <p className="text-slate-700">Observed Plate: <span className="font-bold text-slate-900 font-mono text-xs">{scan.plate}</span></p>
                          <p className="text-slate-500 text-[11px]">Coords: <span className="font-mono text-slate-600">{scan.latitude.toFixed(5)}, {scan.longitude.toFixed(5)}</span></p>
                          {scan.image_url && (
                            <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 max-h-24">
                              <img src={scan.image_url} alt="Telemetry Evidence Block" className="w-full h-full object-cover object-center transition duration-150" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center p-6">
                <p className="text-xs text-slate-400 italic">Select an active investigation target row component from your panel to plot chronological geographical tracking grids.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}