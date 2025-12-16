/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "three" {
  export class Vector2 {
    constructor(x?: number, y?: number);
    x: number;
    y: number;
    set(x: number, y: number): this;
  }

  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
  }

  export class Vector4 {
    constructor(x?: number, y?: number, z?: number, w?: number);
    x: number;
    y: number;
    z: number;
    w: number;
  }

  export class Color {
    constructor(r?: number, g?: number, b?: number);
  }

  export class BufferAttribute {
    constructor(array: Float32Array, itemSize: number);
    needsUpdate: boolean;
  }

  export class BufferGeometry {
    attributes: any;
    setAttribute(name: string, attribute: BufferAttribute): void;
    dispose(): void;
  }

  export class Material {
    dispose(): void;
  }

  export class LineBasicMaterial extends Material {
    constructor(parameters?: any);
  }

  export class LineSegments {
    constructor(geometry?: any, material?: any);
    geometry: BufferGeometry;
    material: Material | Material[];
    rotation: { x: number; y: number; z: number };
  }

  export class Sprite {
    constructor(material?: any);
    material: any;
    position: Vector3;
    scale: Vector3;
  }

  export class Scene {
    constructor();
    add(object: any): void;
  }

  export class PerspectiveCamera {
    constructor(fov: number, aspect: number, near: number, far: number);
    position: { x: number; y: number; z: number };
    aspect: number;
    updateProjectionMatrix(): void;
  }

  export class Group {
    constructor();
    add(object: any): void;
    rotation: { x: number; y: number; z: number };
    scale: { set(x: number, y: number, z: number): void };
  }

  export class Points {
    rotation: { x: number; y: number; z: number };
  }

  export class WebGLRenderer {
    constructor(parameters: any);
    setPixelRatio(pixelRatio: number): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
    setClearColor(color: number, alpha: number): void;
    render(scene: Scene, camera: any): void;
    dispose(): void;
    domElement: HTMLElement;
  }
}

