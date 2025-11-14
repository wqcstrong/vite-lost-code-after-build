/* eslint-disable @typescript-eslint/no-unused-vars */
interface UniformConfig {
  type: "int" | "float" | "vec2" | "vec3" | "vec4" | "mat2" | "mat3" | "mat4";
  value: number | number[];
  location?: WebGLUniformLocation | null;
}

interface BufferConfig {
  size: number;
  data: number[];
  buffer?: WebGLBuffer | null;
}

interface CameraConfig {
  fov: number;
  near: number;
  far: number;
  aspect: number;
  z: number;
  perspective: boolean;
}

interface TimeData {
  start: number;
  old: number;
}

interface ShaderProgramOptions {
  antialias?: boolean;
  depthTest?: boolean;
  mousemove?: boolean;
  autosize?: boolean;
  side?: string;
  vertex?: string;
  fragment?: string;
  uniforms?: Record<string, Omit<UniformConfig, "location">>;
  buffers?: Record<string, Omit<BufferConfig, "buffer">>;
  camera?: Partial<CameraConfig>;
  texture?: string | null;
  onUpdate?: (this: ShaderProgram, delta: number) => void;
  onResize?: (this: ShaderProgram, width: number, height: number, dpi: number) => void;
}

interface ShaderProgramData {
  uniforms: Record<string, UniformConfig>;
  buffers: Record<string, BufferConfig>;
}

export default class ShaderProgram {
  public count: number = 0;
  public gl: WebGLRenderingContext;
  public canvas: HTMLCanvasElement;
  public camera: CameraConfig;
  public holder: HTMLElement;
  public onUpdate: (this: ShaderProgram, delta: number) => void;
  public onResize: (this: ShaderProgram, width: number, height: number, dpi: number) => void;
  public data: ShaderProgramData;
  public uniforms: Record<string, unknown>;
  public buffers: Record<string, unknown>;
  public width: number = 0;
  public height: number = 0;
  public aspect: number = 1;
  public program!: WebGLProgram;
  public texture!: WebGLTexture;
  public time: TimeData;
  public update: () => void;
  private animationFrameId: number | null = null;
  private resizeHandler: ((e: Event) => void) | null = null;
  private mousemoveHandler: ((e: MouseEvent) => void) | null = null;

  constructor(holder: HTMLElement, options: ShaderProgramOptions = {}) {
    const defaultOptions: Required<ShaderProgramOptions> = {
      antialias: false,
      depthTest: false,
      mousemove: false,
      autosize: true,
      side: "front",
      vertex: `
        precision highp float;

        attribute vec4 a_position;
        attribute vec4 a_color;

        uniform float u_time;
        uniform vec2 u_resolution;
        uniform vec2 u_mousemove;
        uniform mat4 u_projection;

        varying vec4 v_color;

        void main() {

          gl_Position = u_projection * a_position;
          gl_PointSize = (10.0 / gl_Position.w) * 100.0;

          v_color = a_color;

        }`,
      fragment: `
        precision highp float;

        uniform sampler2D u_texture;
        uniform int u_hasTexture;

        varying vec4 v_color;

        void main() {

          if ( u_hasTexture == 1 ) {

            gl_FragColor = v_color * texture2D(u_texture, gl_PointCoord);

          } else {

            gl_FragColor = v_color;

          }

        }`,
      uniforms: {},
      buffers: {},
      camera: {},
      texture: null,
      onUpdate: () => {},
      onResize: () => {},
      ...options,
    };

    const uniforms: Record<string, UniformConfig> = {
      time: { type: "float", value: 0 },
      hasTexture: { type: "int", value: 0 },
      resolution: { type: "vec2", value: [0, 0] },
      mousemove: { type: "vec2", value: [0, 0] },
      projection: {
        type: "mat4",
        value: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      },
      ...defaultOptions.uniforms,
    };

    const buffers: Record<string, BufferConfig> = {
      position: { size: 3, data: [] },
      color: { size: 4, data: [] },
      ...defaultOptions.buffers,
    };

    const camera: CameraConfig = {
      fov: 60,
      near: 1,
      far: 10000,
      aspect: 1,
      z: 100,
      perspective: true,
      ...defaultOptions.camera,
    };

    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", {
      antialias: defaultOptions.antialias,
    });

    if (!gl) {
      throw new Error("WebGL not supported");
    }

    this.gl = gl;
    this.canvas = canvas;
    this.camera = camera;
    this.holder = holder;
    this.onUpdate = defaultOptions.onUpdate.bind(this);
    this.onResize = defaultOptions.onResize.bind(this);
    this.data = { uniforms: {}, buffers: {} };
    this.uniforms = {};
    this.buffers = {};

    holder.appendChild(canvas);

    this.createProgram(defaultOptions.vertex, defaultOptions.fragment);

    this.createBuffers(buffers);
    this.createUniforms(uniforms);

    this.updateBuffers();
    this.updateUniforms();

    this.createTexture(defaultOptions.texture);

    gl.enable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl[defaultOptions.depthTest ? "enable" : "disable"](gl.DEPTH_TEST);

    if (defaultOptions.autosize) {
      this.resizeHandler = (e) => this.resize(e);
      window.addEventListener("resize", this.resizeHandler, false);
    }
    if (defaultOptions.mousemove) {
      this.mousemoveHandler = (e) => this.mousemove(e);
      window.addEventListener("mousemove", this.mousemoveHandler, false);
    }

    this.resize();

    this.time = { start: performance.now(), old: performance.now() };
    this.update = this._update.bind(this);
    this.update();
  }

  private mousemove(e: MouseEvent): void {
    const x = (e.pageX / this.width) * 2 - 1;
    const y = (e.pageY / this.height) * 2 - 1;

    this.uniforms.mousemove = [x, y];
  }

  private resize(_e?: Event): void {
    const holder = this.holder;
    const canvas = this.canvas;
    const gl = this.gl;

    const width = (this.width = holder.offsetWidth);
    const height = (this.height = holder.offsetHeight);
    const aspect = (this.aspect = width / height);
    const dpi = devicePixelRatio;

    canvas.width = width * dpi;
    canvas.height = height * dpi;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    gl.viewport(0, 0, width * dpi, height * dpi);
    gl.clearColor(0, 0, 0, 0);

    this.uniforms.resolution = [width, height];
    this.uniforms.projection = this.setProjection(aspect);

    this.onResize.call(this, width, height, dpi);
  }

  private setProjection(aspect: number): number[] {
    const camera = this.camera;

    if (camera.perspective) {
      camera.aspect = aspect;

      const fovRad = camera.fov * (Math.PI / 180);
      const f = Math.tan(Math.PI * 0.5 - 0.5 * fovRad);
      const rangeInv = 1.0 / (camera.near - camera.far);

      const matrix = [
        f / camera.aspect,
        0,
        0,
        0,
        0,
        f,
        0,
        0,
        0,
        0,
        (camera.near + camera.far) * rangeInv,
        -1,
        0,
        0,
        camera.near * camera.far * rangeInv * 2,
        0,
      ];

      matrix[14] += camera.z;
      matrix[15] += camera.z;

      return matrix;
    } else {
      return [2 / this.width, 0, 0, 0, 0, -2 / this.height, 0, 0, 0, 0, 1, 0, -1, 1, 0, 1];
    }
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);

    if (!shader) {
      throw new Error("Failed to create shader");
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      return shader;
    } else {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${error}`);
    }
  }

  private createProgram(vertex: string, fragment: string): void {
    const gl = this.gl;

    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertex);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragment);

    const program = gl.createProgram();

    if (!program) {
      throw new Error("Failed to create program");
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.useProgram(program);
      this.program = program;
    } else {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program linking failed: ${error}`);
    }
  }

  private createUniforms(data: Record<string, UniformConfig>): void {
    const gl = this.gl;
    const uniforms = (this.data.uniforms = data);
    const values = (this.uniforms = {} as Record<string, unknown>);

    Object.keys(uniforms).forEach((name) => {
      const uniform = uniforms[name];

      uniform.location = gl.getUniformLocation(this.program, "u_" + name);

      Object.defineProperty(values, name, {
        set: (value: number | number[]) => {
          if (uniforms[name]) {
            uniforms[name].value = value;
            this.setUniform(name, value);
          }
        },
        get: () => uniforms[name]?.value,
      });
    });
  }

  private setUniform(name: string, value: number | number[]): void {
    const gl = this.gl;
    const uniform = this.data.uniforms[name];

    if (!uniform || !uniform.location) return;

    uniform.value = value;

    switch (uniform.type) {
      case "int": {
        gl.uniform1i(uniform.location, value as number);
        break;
      }
      case "float": {
        gl.uniform1f(uniform.location, value as number);
        break;
      }
      case "vec2": {
        const arr = value as number[];
        gl.uniform2f(uniform.location, arr[0], arr[1]);
        break;
      }
      case "vec3": {
        const arr = value as number[];
        gl.uniform3f(uniform.location, arr[0], arr[1], arr[2]);
        break;
      }
      case "vec4": {
        const arr = value as number[];
        gl.uniform4f(uniform.location, arr[0], arr[1], arr[2], arr[3]);
        break;
      }
      case "mat2": {
        gl.uniformMatrix2fv(uniform.location, false, value as number[]);
        break;
      }
      case "mat3": {
        gl.uniformMatrix3fv(uniform.location, false, value as number[]);
        break;
      }
      case "mat4": {
        gl.uniformMatrix4fv(uniform.location, false, value as number[]);
        break;
      }
    }
  }

  private updateUniforms(): void {
    const uniforms = this.data.uniforms;

    Object.keys(uniforms).forEach((name) => {
      const uniform = uniforms[name];
      this.uniforms[name] = uniform.value;
    });
  }

  private createBuffers(data: Record<string, BufferConfig>): void {
    const buffers = (this.data.buffers = data);
    const values = (this.buffers = {} as Record<string, unknown>);

    Object.keys(buffers).forEach((name) => {
      const buffer = buffers[name];
      buffer.buffer = this.createBuffer("a_" + name, buffer.size);

      Object.defineProperty(values, name, {
        set: (data: number[]) => {
          if (buffers[name]) {
            buffers[name].data = data;
            this.setBuffer(name, data);

            if (name === "position") {
              this.count = buffers.position.data.length / 3;
            }
          }
        },
        get: () => buffers[name]?.data,
      });
    });
  }

  private createBuffer(name: string, size: number): WebGLBuffer {
    const gl = this.gl;
    const program = this.program;

    const index = gl.getAttribLocation(program, name);
    const buffer = gl.createBuffer();

    if (!buffer) {
      throw new Error(`Failed to create buffer: ${name}`);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(index);
    gl.vertexAttribPointer(index, size, gl.FLOAT, false, 0, 0);

    return buffer;
  }

  public setBuffer(name: string | null, data?: number[]): void {
    const gl = this.gl;
    const buffers = this.data.buffers;

    if (name === null) {
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      return;
    }

    if (data) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[name].buffer!);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    }
  }

  private updateBuffers(): void {
    const buffers = this.data.buffers;

    Object.keys(buffers).forEach((name) => {
      this.buffers[name] = buffers[name].data;
    });

    this.setBuffer(null);
  }

  private createTexture(src: string | null): void {
    const gl = this.gl;
    const texture = gl.createTexture();

    if (!texture) {
      throw new Error("Failed to create texture");
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0])
    );

    this.texture = texture;

    if (src) {
      this.uniforms.hasTexture = 1;
      this.loadTexture(src);
    }
  }

  private loadTexture(src: string): void {
    const gl = this.gl;
    const texture = this.texture;

    const textureImage = new Image();

    textureImage.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);

      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureImage);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };

    textureImage.src = src;
  }

  private _update(): void {
    const gl = this.gl;

    const now = performance.now();
    const elapsed = (now - this.time.start) / 5000;
    const delta = now - this.time.old;
    this.time.old = now;

    this.uniforms.time = elapsed;

    if (this.count > 0) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, this.count);
    }

    this.onUpdate.call(this, delta);

    this.animationFrameId = requestAnimationFrame(this.update);
  }

  /**
   * 销毁 ShaderProgram 实例，清理所有资源
   * 包括：停止动画循环、移除事件监听、清理 WebGL 资源、移除 DOM 元素
   */
  public destroy(): void {
    // 停止动画循环
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // 移除事件监听器
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.mousemoveHandler) {
      window.removeEventListener("mousemove", this.mousemoveHandler);
      this.mousemoveHandler = null;
    }

    const gl = this.gl;

    // 清理 WebGL 缓冲区
    if (this.data.buffers) {
      Object.values(this.data.buffers).forEach((buffer) => {
        if (buffer.buffer) {
          gl.deleteBuffer(buffer.buffer);
        }
      });
    }

    // 清理 WebGL 纹理
    if (this.texture) {
      gl.deleteTexture(this.texture);
    }

    // 清理 WebGL 程序
    if (this.program) {
      gl.deleteProgram(this.program);
    }

    // 移除 canvas 元素
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
