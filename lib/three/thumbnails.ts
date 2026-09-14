// lib/three/thumbnails.ts
import * as THREE from "three";
import { PRODUCT_BY_ID, defaultParamsFor } from "@/lib/data/products";

const _cache = new Map<string, string | null>();
let _renderer: THREE.WebGLRenderer | null = null;
let _scene: THREE.Scene | null = null;
let _camera: THREE.PerspectiveCamera | null = null;

function ensureRenderer() {
  if (_renderer) return true;
  if (typeof window === "undefined") return false;
  try {
    _renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true, preserveDrawingBuffer: true,
    });
    _renderer.setPixelRatio(2);
    _renderer.setSize(96, 96);
    _renderer.shadowMap.enabled = false;
    _renderer.toneMapping = THREE.ACESFilmicToneMapping;
    _renderer.toneMappingExposure = 1.05;
    _scene = new THREE.Scene();
    _scene.add(new THREE.HemisphereLight(0xffffff, 0x887e6c, 1.0));
    const d1 = new THREE.DirectionalLight(0xffffff, 1.0);
    d1.position.set(2.5, 3.5, 3);
    _scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xd9e3f0, 0.4);
    d2.position.set(-2.5, 1.5, -2);
    _scene.add(d2);
    const d3 = new THREE.DirectionalLight(0xfff2df, 0.3);
    d3.position.set(0, -1, 2);
    _scene.add(d3);
    _camera = new THREE.PerspectiveCamera(32, 1, 0.001, 100);
    return true;
  } catch (e) {
    return false;
  }
}

export function getProductThumbnail(productId: string): string | null {
  if (_cache.has(productId)) return _cache.get(productId)!;
  if (typeof window === "undefined") return null;
  const product = PRODUCT_BY_ID.get(productId);
  if (!product) return null;
  if (!ensureRenderer()) return null;

  for (let i = _scene!.children.length - 1; i >= 3; i--)
    _scene!.remove(_scene!.children[i]);

  const params = defaultParamsFor(product);
  let group: THREE.Group;
  try {
    group = product.build(params, params.color, params);
  } catch (e) {
    return null;
  }
  if (!group) return null;

  _scene!.add(group);
  const box = new THREE.Box3().setFromObject(group);
  if (!isFinite(box.min.x)) {
    _scene!.remove(group);
    return null;
  }
  const size3 = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size3.x, size3.y, size3.z, 0.05);
  const dist = maxDim * 2.05;
  _camera!.position.set(
    center.x + dist * 0.75,
    center.y + dist * 0.32,
    center.z + dist * 0.85,
  );
  _camera!.lookAt(center);
  _camera!.aspect = 1;
  _camera!.updateProjectionMatrix();
  _renderer!.render(_scene!, _camera!);

  let url: string | null = null;
  try {
    url = _renderer!.domElement.toDataURL("image/png");
  } catch (e) {}

  group.traverse((o: any) => {
    if (o.geometry?.dispose) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material))
        o.material.forEach((m: any) => m?.dispose?.());
      else o.material.dispose?.();
    }
  });
  _scene!.remove(group);
  _cache.set(productId, url);
  return url;
}