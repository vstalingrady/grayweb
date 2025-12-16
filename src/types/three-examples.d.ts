declare module 'three/examples/jsm/postprocessing/EffectComposer.js' {
  import type { WebGLRenderer } from 'three';

  export class EffectComposer {
    constructor(renderer: WebGLRenderer);
    addPass(pass: unknown): void;
    render(): void;
    setSize(width: number, height: number): void;
  }
}

declare module 'three/examples/jsm/postprocessing/RenderPass.js' {
  import type { Scene, Camera } from 'three';

  export class RenderPass {
    constructor(scene: Scene, camera: Camera);
  }
}

declare module 'three/examples/jsm/postprocessing/UnrealBloomPass.js' {
  import type { Vector2 } from 'three';

  export class UnrealBloomPass {
    constructor(resolution: Vector2, strength: number, radius: number, threshold: number);
  }
}

