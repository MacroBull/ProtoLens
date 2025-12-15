import * as protobuf from 'protobufjs';
import { ByteRegion } from '../types';

/**
 * Custom decoder that tracks byte offsets for every field.
 */
export function decodeWithRegions(
  type: protobuf.Type,
  buffer: Uint8Array
): { result: any; regions: ByteRegion[] } {
  const regions: ByteRegion[] = [];
  const result: any = {};
  
  // Create a reader to parse the buffer
  const reader = protobuf.Reader.create(buffer);
  
  // Recursive function to read messages
  function readMessage(
    currentType: protobuf.Type,
    endPos: number,
    targetObj: any,
    basePath: string,
    depth: number,
    globalOffset: number // Tracks the absolute offset in the original buffer
  ) {
    while (reader.pos < endPos) {
      const startPos = reader.pos;
      const tag = reader.uint32();
      const fieldId = tag >>> 3;
      const wireType = tag & 7;

      let field = null;
      for (const name in currentType.fields) {
        const field_ = currentType.fields[name];
        if (field_.id == fieldId) {
          field = field_;
          break;
        }
      }
      const fieldName = field ? field.name : `unknown_${fieldId}`;
      
      // Determine array index if repeated
      let currentPath = basePath ? `${basePath}.${fieldName}` : fieldName;
      if (field && field.repeated && !targetObj[fieldName]) {
        targetObj[fieldName] = [];
      }
      if (field && field.repeated && Array.isArray(targetObj[fieldName])) {
        currentPath = `${currentPath}[${targetObj[fieldName].length}]`;
      }

      let value: any = null;
      let regionStart = startPos + globalOffset; // Absolute start
      
      // Handle known fields
      if (field) {
        if (field.map) {
          // Simplification: Skip detailed map breakdown for this demo or treat as generic
          reader.skipType(wireType); 
        } else if (field.repeated && field.packed && wireType === 2) {
          // Packed repeated fields
          const packedLen = reader.uint32();
          const packedEnd = reader.pos + packedLen;
          if (!targetObj[fieldName]) targetObj[fieldName] = [];
          
          // We treat the whole packed block as one region for now to avoid complexity
          // ideally we would iterate inside
          const arr = targetObj[fieldName];
          while (reader.pos < packedEnd) {
             let val = (reader as any)[field.type]();
             arr.push(val);
          }
           regions.push({
            start: regionStart,
            end: reader.pos + globalOffset,
            path: basePath ? `${basePath}.${fieldName}` : fieldName, // Highlight whole array
            value: arr,
            type: `packed ${field.type}`,
            wireType,
            fieldName,
            depth
          });
          continue;
        } else {
          // Standard fields
          if (wireType === 2 && field.resolvedType instanceof protobuf.Type) {
            // Nested Message
            const len = reader.uint32();
            const msgEnd = reader.pos + len;
            const nestedObj = {};
            
            // Record the region for the *entire* nested message wrapper first
            const wrapperStart = regionStart;
            // We'll update the end later or push now.
            // Let's push a region for the header/wrapper
            
            if (field.repeated) {
              targetObj[fieldName].push(nestedObj);
            } else {
              targetObj[fieldName] = nestedObj;
            }

            // Recurse
            // Note: We don't create a new Reader, we just pass the bounds on the existing one.
            // But for offset tracking, 'globalOffset' remains 0 relative to this reader, 
            // BUT since we are using one single reader for the whole buffer, 
            // reader.pos IS the offset (if we didn't slice).
            // Wait, protobuf.Reader.create(buffer) makes pos=0.
            // So reader.pos is always absolute if we don't slice.
            // The recursive call doesn't need 'globalOffset' if we use the same reader.
            
            // Actually, let's keep it simple: We use ONE reader.
            readMessage(field.resolvedType as protobuf.Type, msgEnd, nestedObj, currentPath, depth + 1, 0);
            
            value = nestedObj;
          } else {
            // Scalar or String/Bytes
            // Use reflection to call the read method (e.g. reader.int32(), reader.string())
            // Types: double, float, int32, int64, uint32, uint64, sint32, sint64, bool, string, bytes
            const readMethod = field.type;
            if (typeof reader[readMethod as keyof protobuf.Reader] === 'function') {
                // @ts-ignore
                value = reader[readMethod]();
            } else {
                // Fallback for unknown types or enums
                // Enums are usually int32
                if (field.resolvedType instanceof protobuf.Enum) {
                   value = reader.int32();
                } else {
                   reader.skipType(wireType);
                   value = "[Skipped]";
                }
            }

            if (field.repeated) {
              targetObj[fieldName].push(value);
            } else {
              targetObj[fieldName] = value;
            }
          }
        }
      } else {
        // Unknown field
        reader.skipType(wireType);
        value = "Unknown Field";
      }

      // Record Region
      // We push specific leaf regions. Parent regions (messages) are implicitly composed of children,
      // but we might want to see the container too.
      // Let's push the region we just read.
      regions.push({
        start: startPos, // Absolute because we never sliced the reader
        end: reader.pos,
        path: currentPath,
        value: value,
        type: field ? field.type : 'unknown',
        wireType,
        fieldName,
        depth
      });
    }
  }

  try {
    readMessage(type, reader.len, result, "", 0, 0);
  } catch (err) {
    console.error("Decoding error:", err);
    throw new Error("Failed to decode binary with provided proto type.");
  }

  return { result, regions };
}

/**
 * Finds the specific byte region that covers the given byte index.
 * We want the most specific (deepest/smallest) region.
 */
export function findRegionByByte(regions: ByteRegion[], byteIndex: number): ByteRegion | undefined {
  // Filter regions containing the byte
  const candidates = regions.filter(r => byteIndex >= r.start && byteIndex < r.end);
  // Sort by length ascending (smallest first) or depth descending
  candidates.sort((a, b) => (a.end - a.start) - (b.end - b.start));
  return candidates[0];
}

export function findRegionsByPath(regions: ByteRegion[], path: string): ByteRegion[] {
  return regions.filter(r => r.path === path);
}