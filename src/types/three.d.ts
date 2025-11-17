declare module 'three' {
  class Scene {
    constructor();
    add(object: any): void;
  }
  class OrthographicCamera {
    constructor(left: number, right: number, top: number, bottom: number, near: number, far: number);
  }
  class WebGLRenderer {
    constructor(params: any);
    setPixelRatio(pixelRatio: number): void;
    setSize(width: number, height: number): void;
    setClearColor(color: number, alpha: number): void;
    render(scene: Scene, camera: OrthographicCamera): void;
    dispose(): void;
    domElement: HTMLElement;
  }
  class Mesh {
    constructor(geometry?: any, material?: any);
  }
  class ShaderMaterial {
    constructor(params?: any);
    uniforms: any;
    dispose(): void;
  }
  class PlaneGeometry {
    constructor(width: number, height: number);
    dispose(): void;
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
  class BufferGeometry {}
  class Clock {
    constructor();
    getDelta(): number;
  }

  namespace MathUtils {
    function degToRad(degrees: number): number;
  }

  export {
    Scene,
    OrthographicCamera,
    WebGLRenderer,
    Mesh,
    ShaderMaterial,
    PlaneGeometry,
    Color,
    Vector3,
    Vector2,
    BufferGeometry,
    Clock,
    MathUtils,
  };
}
