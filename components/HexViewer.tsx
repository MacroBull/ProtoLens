import React, { useMemo } from 'react';
import { clsx } from 'clsx';
import { ByteRegion } from '../types';

interface HexViewerProps {
  data: Uint8Array;
  hoveredRegion?: ByteRegion;
  hoveredByteIndex?: number;
  onHoverByte: (index: number | undefined) => void;
  regions: ByteRegion[];
}

const HexViewer: React.FC<HexViewerProps> = ({ 
  data, 
  hoveredRegion, 
  hoveredByteIndex,
  onHoverByte,
  regions 
}) => {
  
  // Memoize the grid generation to avoid lag on large files
  const grid = useMemo(() => {
    const rows = [];
    const bytesPerRow = 16;
    
    for (let i = 0; i < data.length; i += bytesPerRow) {
      rows.push(Array.from(data.slice(i, i + bytesPerRow)));
    }
    return rows;
  }, [data]);

  const isHighlighted = (index: number) => {
    if (!hoveredRegion) return false;
    return index >= hoveredRegion.start && index < hoveredRegion.end;
  };
  
  // A color map for depths to make visual scanning easier even without hover
  const getDepthColor = (index: number) => {
      // Find the deepest region covering this byte
      // This is expensive to do for every byte on render. 
      // We might skip this for v1 or optimize.
      return ''; 
  };

  return (
    <div className="font-mono text-sm h-full overflow-auto bg-white border rounded-lg shadow-sm">
      <div className="sticky top-0 bg-slate-100 border-b flex px-2 py-1 text-xs text-slate-500 z-10">
        <div className="w-16">Offset</div>
        <div className="flex-1 grid grid-cols-16 gap-x-1 pl-4">
            {Array.from({length: 16}).map((_, i) => (
                <span key={i} className="text-center">{i.toString(16).toUpperCase().padStart(2, '0')}</span>
            ))}
        </div>
        <div className="w-40 pl-4 hidden md:block">ASCII</div>
      </div>

      <div className="p-2">
        {grid.map((row, rowIndex) => {
            const offset = rowIndex * 16;
            return (
                <div key={rowIndex} className="flex hover:bg-slate-50 rounded">
                    {/* Offset Label */}
                    <div className="w-16 text-slate-400 select-none py-0.5">
                        {offset.toString(16).toUpperCase().padStart(6, '0')}
                    </div>

                    {/* Hex Bytes */}
                    <div className="flex-1 grid grid-cols-16 gap-x-1 pl-4">
                        {row.map((byte, colIndex) => {
                            const actualIndex = offset + colIndex;
                            const highlighted = isHighlighted(actualIndex);
                            const isHovered = hoveredByteIndex === actualIndex;

                            return (
                                <div
                                    key={colIndex}
                                    onMouseEnter={() => onHoverByte(actualIndex)}
                                    onMouseLeave={() => onHoverByte(undefined)}
                                    className={clsx(
                                        "text-center cursor-pointer rounded transition-colors duration-75 py-0.5",
                                        isHovered && "bg-brand-500 text-white font-bold ring-2 ring-brand-300 z-20 scale-110",
                                        highlighted && !isHovered && "bg-brand-100 text-brand-700",
                                        !highlighted && !isHovered && "text-slate-600 hover:bg-slate-200"
                                    )}
                                    data-index={actualIndex}
                                >
                                    {byte.toString(16).toUpperCase().padStart(2, '0')}
                                </div>
                            );
                        })}
                    </div>

                    {/* ASCII Preview */}
                    <div className="w-40 pl-4 hidden md:flex text-slate-400 py-0.5 tracking-widest">
                         {row.map((byte, colIndex) => {
                             const char = (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
                             const actualIndex = offset + colIndex;
                             const highlighted = isHighlighted(actualIndex);
                             return (
                                <span 
                                    key={colIndex} 
                                    className={clsx(
                                        highlighted ? "text-brand-600 font-bold" : ""
                                    )}
                                >
                                    {char}
                                </span>
                             );
                         })}
                    </div>
                </div>
            );
        })}
        {data.length === 0 && (
            <div className="text-center text-slate-400 py-10 italic">
                No binary data loaded
            </div>
        )}
      </div>
    </div>
  );
};

export default HexViewer;
