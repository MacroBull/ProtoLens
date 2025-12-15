export interface ByteRegion {
  start: number;
  end: number;
  path: string;
  value: any;
  type: string;
  wireType: number;
  fieldName: string;
  depth: number;
}

export interface ProtoFileState {
  name: string;
  content: string;
  parsedRoot: any | null; // protobuf.Root
  types: string[]; // List of available message types
}

export interface DecodingResult {
  data: any;
  regions: ByteRegion[];
  error?: string;
}

export interface HoverState {
  path?: string;
  byteIndex?: number;
}
