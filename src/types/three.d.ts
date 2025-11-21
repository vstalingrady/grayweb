declare module 'three' {
  class Scene {
    constructor();
    add(object: any): void;
  }
  class PerspectiveCamera {
    constructor(fov: number, aspect: number, near: number, far: number);
    position: { z: number; x: number; y: number };
    aspect: number;
    updateProjectionMatrix(): void;
  }
  class OrthographicCamera {
    constructor(left: number, right: number, top: number, bottom: number, near: number, far: number);
  }
  class WebGLRenderer {
    constructor(params: any);
    setPixelRatio(pixelRatio: number): void;
    setSize(width: number, height: number): void;
    setClearColor(color: number, alpha: number): void;
    render(scene: Scene, camera: any): void;
    dispose(): void;
    domElement: HTMLElement;
  }
  class Group {
    constructor();
    add(object: any): void;
    rotation: { x: number; y: number; z: number };
  }
  class Mesh {
    constructor(geometry?: any, material?: any);
  }
  class LineSegments {
    constructor(geometry?: any, material?: any);
  }
  class ShaderMaterial {
    constructor(params?: any);
    uniforms: any;
    dispose(): void;
  }
  class LineBasicMaterial {
    constructor(params?: any);
  }
  class BoxGeometry {
    constructor(width: number, height: number, depth: number);
  }
  class PlaneGeometry {
    constructor(width: number, height: number);
    dispose(): void;
  }
  class EdgesGeometry {
    constructor(geometry: any);
  }
  class BufferGeometry {
    setAttribute(name: string, attribute: any): void;
  }
  class BufferAttribute {
    constructor(array: Float32Array, itemSize: number);
  }
  class Color {
    constructor(color?: number);
  }
  class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    clone(): Vector3;
    sub(v: Vector3): Vector3;
    normalize(): Vector3;
    crossVectors(a: Vector3, b: Vector3): Vector3;
  }
  class Vector2 {
    constructor(x?: number, y?: number);
    x: number;
    y: number;
    set(x: number, y: number): void;
  }
  class Clock {
    constructor();
    getDelta(): number;
  }

  namespace MathUtils {
    function degToRad(degrees: number): number;
  }

  export {
    Scene,
    PerspectiveCamera,
    OrthographicCamera,
    WebGLRenderer,
    Group,
    Mesh,
    LineSegments,
    ShaderMaterial,
    LineBasicMaterial,
    BoxGeometry,
    PlaneGeometry,
    EdgesGeometry,
    BufferGeometry,
    BufferAttribute,
    Color,
    Vector3,
    Vector2,
    Clock,
    MathUtils,
  };
}
