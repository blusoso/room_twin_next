// app/RoomTwinClient.tsx
"use client";
import dynamic from "next/dynamic";

const RoomTwinApp = dynamic(() => import("@/components/RoomTwinApp"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#ece4d4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        color: "#746c60",
        fontSize: 14,
      }}
    >
      กำลังโหลด RoomTwin…
    </div>
  ),
});

export default function RoomTwinClient() {
  return <RoomTwinApp />;
}