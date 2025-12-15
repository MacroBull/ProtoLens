import React, { useState, useEffect, useCallback } from 'react';
import * as protobuf from 'protobufjs';
import { Upload, FileCode, FileDigit, AlertCircle, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import { ProtoFileState, DecodingResult, ByteRegion } from './types';
import { decodeWithRegions, findRegionByByte } from './utils/protoDecoder';
import HexViewer from './components/HexViewer';
import JsonViewer from './components/JsonViewer';

// Example placeholder proto
const DEFAULT_PROTO = `syntax = "proto3";

package example;

message Person {
  string name = 1;
  int32 id = 2;
  string email = 3;
  
  enum PhoneType {
    MOBILE = 0;
    HOME = 1;
    WORK = 2;
  }

  message PhoneNumber {
    string number = 1;
    PhoneType type = 2;
  }

  repeated PhoneNumber phones = 4;
}
`;

const App: React.FC = () => {
  // State
  const [protoState, setProtoState] = useState<ProtoFileState>({
    name: 'example.proto',
    content: DEFAULT_PROTO,
    parsedRoot: null,
    types: [],
  });
  
  const [selectedType, setSelectedType] = useState<string>('');
  const [binaryData, setBinaryData] = useState<Uint8Array>(new Uint8Array());
  const [decodingResult, setDecodingResult] = useState<DecodingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Interaction State
  const [hoveredByteIndex, setHoveredByteIndex] = useState<number | undefined>(undefined);
  const [hoveredPath, setHoveredPath] = useState<string | undefined>(undefined);
  const [hoveredRegion, setHoveredRegion] = useState<ByteRegion | undefined>(undefined);

  // Initial Proto Parsing
  useEffect(() => {
    try {
      const parsed = protobuf.parse(protoState.content);
      const types: string[] = [];
      
      // Traverse to find all Message types
      function traverse(obj: any, fullPath: string) {
        if (obj instanceof protobuf.Type) {
          types.push(fullPath);
        }
        if (obj.nested) {
          Object.keys(obj.nested).forEach(key => {
            const nestedPath = fullPath ? `${fullPath}.${key}` : key;
            traverse(obj.nested[key], nestedPath);
          });
        }
      }
      traverse(parsed.root, '');

      setProtoState(prev => ({
        ...prev,
        parsedRoot: parsed.root,
        types: types
      }));

      // Auto select first type if available and none selected
      if (types.length > 0 && !types.includes(selectedType)) {
        setSelectedType(types[0]);
      }
      setError(null);
    } catch (e: any) {
      console.error("Proto parse error", e);
      setError(`Proto syntax error: ${e.message}`);
    }
  }, [protoState.content]);

  // Handle Decoding
  useEffect(() => {
    if (!protoState.parsedRoot || !selectedType || binaryData.length === 0) {
      setDecodingResult(null);
      return;
    }

    try {
      const type = protoState.parsedRoot.lookupType(selectedType);
      const { result, regions } = decodeWithRegions(type, binaryData);
      setDecodingResult({ data: result, regions });
      setError(null);
    } catch (e: any) {
      console.error("Decoding error", e);
      setError(`Decoding failed: ${e.message}`);
      setDecodingResult(null);
    }
  }, [protoState.parsedRoot, selectedType, binaryData]);

  // Sync Hovers
  useEffect(() => {
    if (!decodingResult) return;

    if (hoveredByteIndex !== undefined) {
      const region = findRegionByByte(decodingResult.regions, hoveredByteIndex);
      setHoveredRegion(region);
      setHoveredPath(region?.path);
    } else if (hoveredPath !== undefined) {
      const region = decodingResult.regions.find(r => r.path === hoveredPath);
      setHoveredRegion(region);
    } else {
      setHoveredRegion(undefined);
    }
  }, [hoveredByteIndex, hoveredPath, decodingResult]);


  // Handlers
  const handleProtoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setProtoState(prev => ({ ...prev, name: file.name, content }));
    };
    reader.readAsText(file);
  };

  const handleBinaryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const buffer = ev.target?.result as ArrayBuffer;
      setBinaryData(new Uint8Array(buffer));
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="flex flex-col h-screen max-h-screen">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-brand-200 shadow-lg">
            P
          </div>
          <h1 className="text-xl font-bold text-slate-800">ProtoLens</h1>
        </div>

        <div className="flex items-center gap-4">
            {error && (
                <div className="flex items-center text-red-600 bg-red-50 px-3 py-1.5 rounded-md text-sm font-medium border border-red-100">
                    <AlertCircle size={16} className="mr-2" />
                    {error}
                </div>
            )}
            
            <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-white rounded-md cursor-pointer transition-all text-sm font-medium text-slate-600 hover:text-brand-600 hover:shadow-sm">
                    <FileCode size={16} />
                    <span>Import .proto</span>
                    <input type="file" accept=".proto" onChange={handleProtoUpload} className="hidden" />
                </label>
                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-white rounded-md cursor-pointer transition-all text-sm font-medium text-slate-600 hover:text-brand-600 hover:shadow-sm">
                    <FileDigit size={16} />
                    <span>Import Binary</span>
                    <input type="file" onChange={handleBinaryUpload} className="hidden" />
                </label>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Settings / Info Sidebar */}
        <div className="w-64 bg-slate-50 border-r flex flex-col overflow-y-auto flex-shrink-0">
            <div className="p-4 border-b">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Active Proto Definition
                </label>
                <div className="text-sm font-mono text-slate-700 break-all bg-white p-2 rounded border border-slate-200">
                    {protoState.name}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                    {protoState.types.length} messages found
                </div>
            </div>

            <div className="p-4 border-b">
                 <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Target Message Type
                </label>
                <select 
                    value={selectedType} 
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full text-sm p-2 rounded border border-slate-300 bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                    disabled={protoState.types.length === 0}
                >
                    {protoState.types.map(t => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>
            </div>

            <div className="p-4 flex-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Loaded Binary
                </label>
                <div className="text-sm text-slate-600 mb-2">
                    Size: <span className="font-mono font-semibold">{binaryData.length}</span> bytes
                </div>
                
                {binaryData.length > 0 && (
                    <button 
                        onClick={() => setBinaryData(new Uint8Array())}
                        className="text-xs text-red-500 hover:text-red-700 underline"
                    >
                        Clear Binary
                    </button>
                )}
            </div>
        </div>

        {/* Visualizers Split View */}
        <div className="flex-1 flex flex-col md:flex-row min-w-0 bg-slate-100 p-4 gap-4">
            {/* Left: Hex View */}
            <div className="flex-1 min-h-0 flex flex-col min-w-[300px]">
                <h2 className="text-sm font-semibold text-slate-600 mb-2 flex items-center justify-between">
                    <span>Hex Inspector</span>
                    {hoveredRegion && (
                        <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded font-mono">
                            Offset: {hoveredRegion.start} - {hoveredRegion.end}
                        </span>
                    )}
                </h2>
                <HexViewer 
                    data={binaryData}
                    hoveredRegion={hoveredRegion}
                    hoveredByteIndex={hoveredByteIndex}
                    onHoverByte={setHoveredByteIndex}
                    regions={decodingResult?.regions || []}
                />
            </div>

            {/* Right: Tree View */}
            <div className="flex-1 min-h-0 flex flex-col min-w-[300px]">
                <h2 className="text-sm font-semibold text-slate-600 mb-2 flex items-center justify-between">
                    <span>Decoded Structure</span>
                    {hoveredRegion && (
                        <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded font-mono truncate max-w-[200px]">
                            {hoveredRegion.path}
                        </span>
                    )}
                </h2>
                <JsonViewer 
                    data={decodingResult?.data}
                    regions={decodingResult?.regions || []}
                    hoveredPath={hoveredPath}
                    onHoverPath={setHoveredPath}
                    rootType={selectedType}
                />
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;
