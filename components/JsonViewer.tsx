import React from 'react';
import { clsx } from 'clsx';
import { ChevronRight, ChevronDown, Box, List, Type, Hash } from 'lucide-react';
import { ByteRegion } from '../types';

interface JsonViewerProps {
  data: any;
  regions: ByteRegion[];
  hoveredPath?: string;
  onHoverPath: (path: string | undefined) => void;
  rootType: string;
}

const getIconForValue = (value: any) => {
    if (Array.isArray(value)) return <List size={14} className="text-blue-500" />;
    if (typeof value === 'object' && value !== null) return <Box size={14} className="text-purple-500" />;
    if (typeof value === 'string') return <Type size={14} className="text-green-600" />;
    if (typeof value === 'number') return <Hash size={14} className="text-orange-500" />;
    return <Box size={14} className="text-slate-400" />;
};

const TreeNode: React.FC<{
  name: string;
  value: any;
  path: string;
  depth?: number;
  regions: ByteRegion[];
  hoveredPath?: string;
  onHoverPath: (path: string | undefined) => void;
  isLast?: boolean;
}> = ({ name, value, path, depth = 0, regions, hoveredPath, onHoverPath, isLast }) => {
  const [expanded, setExpanded] = React.useState(true);
  
  const isObject = typeof value === 'object' && value !== null;
  const isArray = Array.isArray(value);
  const isEmpty = isObject && Object.keys(value).length === 0;

  const isHighlighted = hoveredPath === path || (hoveredPath?.startsWith(path + '.') && !expanded);
  
  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    onHoverPath(path);
  };
  
  const handleMouseLeave = () => {
     // We don't clear immediately to avoid flickering, 
     // but parent handler will catch or we let the HexView clear it.
     // Actually for better UX, usually we let the parent handle clearing or specific clear.
     // Here we just don't do anything, relying on other elements to take focus or a global clear.
  };

  const getRegionInfo = () => {
      const r = regions.find(reg => reg.path === path);
      if (!r) return null;
      return (
          <span className="ml-2 text-[10px] text-slate-400 font-mono">
             {r.type} ({(r.end - r.start)}b)
          </span>
      );
  }

  return (
    <div 
        className={clsx(
            "font-mono text-sm select-none",
            isHighlighted && "bg-brand-50 rounded -mx-1 px-1"
        )}
        onMouseEnter={handleMouseEnter}
    >
      <div 
        className="flex items-center py-0.5 hover:text-brand-600 cursor-pointer group"
        onClick={() => isObject && !isEmpty && setExpanded(!expanded)}
      >
        <span className="w-4 h-4 mr-1 flex items-center justify-center text-slate-400 group-hover:text-slate-600">
          {isObject && !isEmpty && (
            expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          )}
        </span>
        
        <span className="mr-2 opacity-70 flex items-center gap-1 text-slate-600">
            {getIconForValue(value)}
            <span className="font-semibold text-slate-700">{name}</span>
        </span>
        
        {!isObject && (
            <span className="text-slate-800 break-all">
                {typeof value === 'string' ? `"${value}"` : String(value)}
            </span>
        )}

        {getRegionInfo()}
        
        {isObject && !expanded && <span className="text-slate-400 ml-2 text-xs">...</span>}
      </div>

      {expanded && isObject && (
        <div className="pl-4 border-l border-slate-200 ml-2">
          {Object.entries(value).map(([key, val], idx, arr) => {
            const currentPath = path ? (isArray ? `${path}[${idx}]` : `${path}.${key}`) : key;
            return (
                <TreeNode
                    key={key}
                    name={key}
                    value={val}
                    path={currentPath}
                    depth={depth + 1}
                    regions={regions}
                    hoveredPath={hoveredPath}
                    onHoverPath={onHoverPath}
                    isLast={idx === arr.length - 1}
                />
            );
          })}
        </div>
      )}
    </div>
  );
};

const JsonViewer: React.FC<JsonViewerProps> = ({ 
  data, 
  regions, 
  hoveredPath, 
  onHoverPath,
  rootType 
}) => {
  if (!data || Object.keys(data).length === 0) {
    return (
        <div className="h-full flex items-center justify-center text-slate-400 italic">
            Waiting for decoded data...
        </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-auto bg-white border rounded-lg shadow-sm" onMouseLeave={() => onHoverPath(undefined)}>
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 border-b pb-2">
        Decoded: {rootType}
      </div>
      <TreeNode 
        name="root" 
        value={data} 
        path="" 
        regions={regions}
        hoveredPath={hoveredPath}
        onHoverPath={onHoverPath}
      />
    </div>
  );
};

export default JsonViewer;
