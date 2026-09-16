// lib/three/instantiate.ts
import * as THREE from "three";
import {
  roomGroup, objectsByUid, surfaceColliders, wallItemMaterials,
} from "./scene";
import { PRODUCT_BY_ID } from "@/lib/data/products";
import { getThemeStyle } from "@/lib/data/themes";
import { wallItemWorld } from "./wallPlacement";
import { useRoomTwin } from "@/lib/state/store";

export function instantiate(item: any) {
  if (item.wallMount) return instantiateWallItem(item);
  if (item.ceilingMount) return instantiateCeilingItem(item);

  const p = PRODUCT_BY_ID.get(item.productId);
  if (!p) return;
  const themeStyle = getThemeStyle(item.themeOverride);
  const bo = Object.assign({}, item.params, { themeStyle });
  const g = p.build(item.params, item.params.color, bo);
  g.position.set(item.x, item.restY || 0, item.z);
  g.rotation.y = item.rotY || 0;
  g.userData.uid = item.uid;
  g.userData.productId = item.productId;
  g.traverse((o) => (o.userData.uid = item.uid));

  if (p.surface) {
    const w = item.params.w / 100;
    const d = item.params.d / 100;
    const h = item.params.h / 100;
    const collider = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.92, d * 0.92),
      new THREE.MeshBasicMaterial({
        transparent: true, opacity: 0, depthWrite: false,
      }),
    );
    collider.rotation.x = -Math.PI / 2;
    collider.position.set(0, p.surface * h, 0);
    collider.userData.hostUid = item.uid;
    collider.castShadow = false;
    collider.receiveShadow = false;
    g.add(collider);
    surfaceColliders.set(item.uid, collider);
  }

  // ⭐ bottomOffset — ระยะจาก origin ถึงขอบล่างจริงของ mesh
  //    roomGroup เป็น identity transform → world min.y − position.y = local bottom
  //    default = 0 สำหรับ product ที่ pivot base; รองรับ product ที่ pivot กลางในอนาคต
  const _bndBox = new THREE.Box3().setFromObject(g);
  if (!_bndBox.isEmpty()) {
    const bottomOffset = _bndBox.min.y - g.position.y;
    g.userData.bottomOffset = bottomOffset;
    if (Math.abs(bottomOffset) > 1e-9) {
      g.position.y = (item.restY || 0) - bottomOffset;
    }
  }

  roomGroup.add(g);
  objectsByUid.set(item.uid, g);
}

export function instantiateWallItem(item: any) {
  const p = PRODUCT_BY_ID.get(item.productId);
  if (!p) return;
  const themeStyle = getThemeStyle(item.themeOverride);
  const bo = Object.assign({}, item.params, { themeStyle });
  const built = p.build(item.params, item.params.color, bo);
  built.rotation.z = item.rotZ || 0;

  const holder = new THREE.Group();
  holder.add(built);
  const pose = wallItemWorld(item);
  if (!pose) return;
  holder.position.set(pose.x, pose.y, pose.z);
  holder.rotation.y = pose.rotY;
  holder.userData.uid = item.uid;
  holder.userData.productId = item.productId;

  const mats: THREE.Material[] = [];
  holder.traverse((o: any) => {
    o.userData.uid = item.uid;
    if (o.isMesh && o.material) {
      o.material.transparent = true;
      mats.push(o.material);
    }
  });
  wallItemMaterials.set(item.uid, mats);
  roomGroup.add(holder);
  objectsByUid.set(item.uid, holder);
}

export function instantiateCeilingItem(item: any) {
  const p = PRODUCT_BY_ID.get(item.productId);
  if (!p) return;
  const { room } = useRoomTwin.getState();
  const themeStyle = getThemeStyle(item.themeOverride);
  const bo = Object.assign({}, item.params, { themeStyle });
  const g = p.build(item.params, item.params.color, bo);
  g.position.set(item.x, room.h, item.z);
  g.rotation.y = item.rotY || 0;
  g.userData.uid = item.uid;
  g.userData.productId = item.productId;
  g.traverse((o) => (o.userData.uid = item.uid));
  roomGroup.add(g);
  objectsByUid.set(item.uid, g);
}

export function reinstantiateItem(uid: string) {
  const { placedItems } = useRoomTwin.getState();
  const item = placedItems.find((i) => i.uid === uid);
  if (!item) return;
  const o = objectsByUid.get(uid);
  if (o) {
    roomGroup.remove(o);
    objectsByUid.delete(uid);
  }
  surfaceColliders.delete(uid);
  wallItemMaterials.delete(uid);
  instantiate(item);
}

export function removeInstantiated(uid: string) {
  const o = objectsByUid.get(uid);
  if (o) {
    o.traverse((child: any) => {
      if (child.isMesh && child.material) {
        const m = child.material;
        if (m.userData?._origEmissive !== undefined) {
          m.emissive?.setHex(m.userData._origEmissive);
          m.emissiveIntensity = m.userData._origEmissiveIntensity;
        }
      }
    });
    roomGroup.remove(o);
    objectsByUid.delete(uid);
  }
  surfaceColliders.delete(uid);
  wallItemMaterials.delete(uid);
}